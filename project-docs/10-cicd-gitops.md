# 10 - CI/CD Pipeline & GitOps Continuous Deployment

To automate the delivery of frontend assets, backend APIs, and database configurations, the platform implements a dual-layer CI/CD pipeline: **Jenkins** for Continuous Integration (CI), and **ArgoCD** for Continuous Deployment (CD/GitOps).

---

## 1. Jenkins CI Pipeline (Integration & Build)

**Jenkins** functions as the primary build automation engine. It is deployed in the `jenkins` namespace and connects to agents dynamically to run pipeline stages.

```
┌─────────────┐        ┌─────────────────┐        ┌──────────────────┐
│ Git Push to │ ──(1)──> │ Jenkins Pipeline│ ──(2)──> │ Run Tests / Lint │
│ GitHub Repo │        │ (Webhook trigger│        └────────┬─────────┘
└─────────────┘        └─────────────────┘                 │
                                                           ▼ (3)
┌─────────────┐        ┌─────────────────┐        ┌──────────────────┐
│ ArgoCD Sync │ <──(5)── │ Update Git Tag  │ <──(4)── │ Docker Build &   │
│ Triggered   │        │ in Config Repo  │        │ Push to Registry │
└─────────────┘        └─────────────────┘        └──────────────────┘
```

### Dynamic Agent Pods
Builds execute on dynamic Kubernetes agents spawned on demand. These agent pods mount the Docker socket or use rootless execution environments to perform container builds.

### SSH Authentication and GitHub Write Access
To allow the pipeline to update deployment tags (committing changes back to the infrastructure repository), a custom SSH Deploy Key configuration is established:
*   **Deploy Key Setup:** A public key (`jenkins-agent-bot.pub`) is registered on the GitHub repository Settings with write access allowed.
*   **Jenkins Credentials Store:** The corresponding private key is saved directly inside Jenkins' credential store as an SSH Username with Private Key credential (`jenkins-agent-bot`).
*   **Pipeline Authentication:** The pipeline uses `sshagent(credentials: ['jenkins-agent-bot'])` to authenticate git commits and push version tag updates to the repository branches.

---

## 2. Pipeline Execution Stages (`Jenkinsfile`)

The pipeline execution flow maps onto distinct stages:

1.  **Checkout Code:** Clones the specific branch triggered by the webhook.
2.  **Lint & Static Analysis:** Runs formatting validations (e.g. `npm run lint` for Next.js, Maven validations for Spring Boot).
3.  **Build Binary:** Compiles code into deployable archives (Next.js production build assets, Spring Boot jar).
4.  **Containerize (Docker Build):** Builds a Docker image using optimized, multi-stage Dockerfiles.
    *   Images are tagged using the local registry domain prefix and commit SHA: `localhost:30500/imperium-frontend:${GIT_COMMIT}`.
5.  **Push to Registry:** Ports are forwarded to the local container registry (`registry.registry.svc.cluster.local:5000`), and the image is uploaded via `docker push`.
6.  **Tag Updates:** Clones the deployment Helm repository, updates the target image tag configuration in `values.yaml`, commits the changes, and pushes the modifications back to Git.

---

## 3. GitOps Continuous Deployment (ArgoCD)

Deployment delivery is strictly declarative, following the **GitOps Philosophy**. 

*   **Single Source of Truth:** Git is the absolute source of truth for the cluster's state. No developer applies YAML configurations directly using `kubectl`.
*   **ArgoCD Orchestrator:** ArgoCD is deployed in the `argocd` namespace. It monitors the infrastructure repository (`imperium-helm-k8s-infra`) and compares the configurations committed in Git with the active state in the Kubernetes cluster.

### Reconciliation and Sync Loop
*   **Automatic Reconciliation:** ArgoCD runs a continuous reconciliation loop (every 3 minutes or immediately upon Git webhook trigger). 
*   **Out-of-Sync Detection:** If a discrepancy is found (e.g. the Jenkins pipeline has bumped an image tag, or a developer manually edited a service replica count in the cluster), ArgoCD marks the application as `OutOfSync`.
*   **Pruning & Self-Healing:** The sync policy is configured with `prune: true` and `selfHeal: true`. ArgoCD will automatically roll back manual cluster edits and delete resources in the cluster that are no longer defined in Git, restoring the cluster to the target state documented in the Helm charts.
