const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/v1';

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

interface LoginData {
  email: string
  password: string
}

interface RegisterData {
  fullName: string
  email: string
  password: string
}

interface ForgotPasswordData {
  email: string
}

type AuthResponseData = {
  token?: string
  user?: {
    id?: string
    fullName?: string
    email?: string
    role?: string
  }
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const contentType = response.headers.get('content-type') || ''
      const rawBody = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

      const data =
        typeof rawBody === 'string'
          ? { message: rawBody.slice(0, 200) }
          : rawBody

      if (!response.ok) {
        return {
          success: false,
          error:
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`,
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  async login(credentials: LoginData): Promise<ApiResponse<AuthResponseData>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async register(userData: RegisterData): Promise<ApiResponse<unknown>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async forgotPassword(emailData: ForgotPasswordData): Promise<ApiResponse<unknown>> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(emailData),
    })
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse<unknown>> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword: password }),
    })
  }

  async logout(): Promise<ApiResponse<unknown>> {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  async getProfile(): Promise<ApiResponse<unknown>> {
    return this.request('/auth/profile', {
      method: 'GET',
    })
  }

  async getProducts(): Promise<ApiResponse<unknown>> {
    return this.request('/products?page=1&limit=1000', {
      method: 'GET',
    })
  }
}

export const apiClient = new ApiClient()
export type { ApiResponse, LoginData, RegisterData, ForgotPasswordData }
