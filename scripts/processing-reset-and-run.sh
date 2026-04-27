#!/usr/bin/env bash

set -euo pipefail

base_dir="$(dirname "$0")"

bash "${base_dir}/processing-down.sh"
bash "${base_dir}/processing-clean.sh"
bash "${base_dir}/processing-up.sh"
bash "${base_dir}/processing-validate.sh"
