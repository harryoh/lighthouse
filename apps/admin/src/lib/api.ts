// Use a constant for the API URL - in production this would come from env vars
const API_BASE_URL = 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Contents API
  async getContents(params?: { page?: number; limit?: number; type?: string }) {
    const stringParams = params
      ? Object.entries(params).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>)
      : undefined;
    return this.request('/api/contents', { params: stringParams });
  }

  async getContent(id: string) {
    return this.request(`/api/contents/${id}`);
  }

  // Crawlers API
  async getCrawlers() {
    return this.request('/api/crawlers');
  }

  async getCrawler(id: string) {
    return this.request(`/api/crawlers/${id}`);
  }

  async startCrawler(id: string) {
    return this.request(`/api/crawlers/${id}/start`, { method: 'POST' });
  }

  async stopCrawler(id: string) {
    return this.request(`/api/crawlers/${id}/stop`, { method: 'POST' });
  }

  async createCrawler(data: unknown) {
    return this.request('/api/crawlers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Jobs API
  async getJobs(params?: { status?: string; type?: string }) {
    const stringParams = params
      ? Object.entries(params).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      : undefined;
    return this.request('/api/jobs', { params: stringParams });
  }

  async getJob(id: string) {
    return this.request(`/api/jobs/${id}`);
  }

  async cancelJob(id: string) {
    return this.request(`/api/jobs/${id}/cancel`, { method: 'POST' });
  }

  async retryJob(id: string) {
    return this.request(`/api/jobs/${id}/retry`, { method: 'POST' });
  }

  // Stats API
  async getStats() {
    return this.request('/api/stats');
  }

  async getDashboardData() {
    return this.request('/api/dashboard');
  }
}

export const api = new ApiClient(API_BASE_URL);
