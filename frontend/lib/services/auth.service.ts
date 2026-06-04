export interface AuthUser {
  userId: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

// Simple email regex for client-side fake validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authService = {
  /**
   * Log in user with email and password.
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Basic Validation
    if (!email || !password) {
      throw new Error('Email and password are required fields.');
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // Mock failure cases for testing
    if (email === 'fail@imperium.com') {
      throw new Error('Invalid email or password. Please try again.');
    }

    const mockUser: AuthUser = {
      userId: `user_uid_${Math.random().toString(36).substring(2, 11)}`,
      name: email.split('@')[0].replace(/[^a-zA-Z]/g, ' '),
      email,
    };
    
    const mockToken = `mock_jwt_header.${btoa(JSON.stringify(mockUser))}.mock_signature`;
    
    // Save to local storage for persistence compatibility
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    return {
      user: mockUser,
      token: mockToken,
    };
  },

  /**
   * Sign up user with name, email, and password.
   */
  signup: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Validation
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required fields.');
    }
    if (name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters.');
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const mockUser: AuthUser = {
      userId: `user_uid_${Math.random().toString(36).substring(2, 11)}`,
      name,
      email,
    };
    
    const mockToken = `mock_jwt_header.${btoa(JSON.stringify(mockUser))}.mock_signature`;
    
    // Save to local storage
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    return {
      user: mockUser,
      token: mockToken,
    };
  },

  /**
   * Log in user using Google OAuth (Mock).
   */
  loginWithGoogle: async (): Promise<AuthResponse> => {
    // Simulate OAuth redirection & auth latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockUser: AuthUser = {
      userId: `user_google_${Math.random().toString(36).substring(2, 11)}`,
      name: 'Google Explorer',
      email: 'explorer@gmail.com',
    };
    
    const mockToken = `mock_jwt_header.${btoa(JSON.stringify(mockUser))}.mock_signature`;
    
    // Save to local storage
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    return {
      user: mockUser,
      token: mockToken,
    };
  },

  /**
   * Logs out user by wiping mock session data.
   */
  logout: async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },
};
