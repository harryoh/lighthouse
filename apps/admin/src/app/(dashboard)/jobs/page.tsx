'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Pause,
  X,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Filter,
  Download,
} from 'lucide-react';

// Mock jobs data
const jobs = [
  {
    id: 'job-001',
    type: 'CRAWL',
    status: 'RUNNING',
    source: 'Naver News',
    progress: 67,
    startedAt: '2024-01-15 14:25:00',
    eta: '5 min',
    payload: { url: 'https://news.naver.com', depth: 3 },
  },
  {
    id: 'job-002',
    type: 'ANALYSIS',
    status: 'PENDING',
    source: 'Content Batch #234',
    progress: 0,
    startedAt: '-',
    eta: 'Waiting',
    payload: { contentIds: ['c1', 'c2', 'c3'], analysisType: 'SENTIMENT' },
  },
  {
    id: 'job-003',
    type: 'EXPORT',
    status: 'COMPLETED',
    source: 'Database Export',
    progress: 100,
    startedAt: '2024-01-15 14:00:00',
    completedAt: '2024-01-15 14:15:00',
    payload: { format: 'CSV', records: 5000 },
  },
  {
    id: 'job-004',
    type: 'CRAWL',
    status: 'FAILED',
    source: 'Twitter',
    progress: 23,
    startedAt: '2024-01-15 13:45:00',
    error: 'Rate limit exceeded',
    payload: { url: 'https://twitter.com', maxPages: 100 },
  },
  {
    id: 'job-005',
    type: 'CLEANUP',
    status: 'RUNNING',
    source: 'Old Content Cleanup',
    progress: 89,
    startedAt: '2024-01-15 14:20:00',
    eta: '2 min',
    payload: { olderThan: '30 days', count: 1234 },
  },
  {
    id: 'job-006',
    type: 'ANALYSIS',
    status: 'CANCELLED',
    source: 'Political Analysis',
    progress: 45,
    startedAt: '2024-01-15 13:00:00',
    cancelledAt: '2024-01-15 13:30:00',
    payload: { contentIds: ['p1', 'p2'], analysisType: 'POLITICAL' },
  },
];

const statusConfig: Record<string, any> = {
  PENDING: {
    color: 'text-gray-500',
    bg: 'bg-gray-500',
    icon: Clock,
    label: 'Pending',
  },
  RUNNING: {
    color: 'text-blue-500',
    bg: 'bg-blue-500',
    icon: Loader2,
    label: 'Running',
  },
  COMPLETED: {
    color: 'text-green-500',
    bg: 'bg-green-500',
    icon: CheckCircle,
    label: 'Completed',
  },
  FAILED: {
    color: 'text-red-500',
    bg: 'bg-red-500',
    icon: XCircle,
    label: 'Failed',
  },
  CANCELLED: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500',
    icon: AlertCircle,
    label: 'Cancelled',
  },
};

const typeColors: Record<string, string> = {
  CRAWL: 'bg-violet-600',
  ANALYSIS: 'bg-blue-600',
  EXPORT: 'bg-green-600',
  CLEANUP: 'bg-orange-600',
};

export default function JobsPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus !== 'ALL' && job.status !== filterStatus) return false;
    if (filterType !== 'ALL' && job.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage background jobs
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="gradient" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = jobs.filter((j) => j.status === status).length;
          const Icon = config.icon;
          return (
            <Card key={status} glass>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {config.label}
                    </p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <Icon
                    className={`w-6 h-6 ${config.color} ${
                      status === 'RUNNING' ? 'animate-spin' : ''
                    }`}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card glass>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div className="flex gap-2">
              <select
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="RUNNING">Running</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="CRAWL">Crawl</option>
                <option value="ANALYSIS">Analysis</option>
                <option value="EXPORT">Export</option>
                <option value="CLEANUP">Cleanup</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.map((job) => {
          const StatusIcon = statusConfig[job.status].icon;
          return (
            <div key={job.id}>
              <Card glass>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Left Section */}
                    <div className="flex items-center space-x-4">
                      <StatusIcon
                        className={`w-8 h-8 ${statusConfig[job.status].color} ${
                          job.status === 'RUNNING' ? 'animate-spin' : ''
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-muted-foreground">
                            {job.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium text-white rounded ${
                              typeColors[job.type]
                            }`}
                          >
                            {job.type}
                          </span>
                        </div>
                        <h3 className="font-semibold">{job.source}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {job.startedAt}
                          </span>
                          {job.status === 'RUNNING' && (
                            <span>ETA: {job.eta}</span>
                          )}
                          {job.status === 'COMPLETED' && job.completedAt && (
                            <span>Completed: {job.completedAt}</span>
                          )}
                          {job.status === 'FAILED' && job.error && (
                            <span className="text-red-500">
                              Error: {job.error}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center space-x-4">
                      {/* Progress Bar */}
                      {(job.status === 'RUNNING' ||
                        job.status === 'CANCELLED' ||
                        job.status === 'FAILED') && (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{job.progress}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                job.status === 'FAILED'
                                  ? 'bg-red-500'
                                  : job.status === 'CANCELLED'
                                  ? 'bg-yellow-500'
                                  : 'bg-gradient-to-r from-violet-600 to-blue-600'
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {job.status === 'RUNNING' && (
                          <>
                            <Button variant="outline" size="icon">
                              <Pause className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {job.status === 'PENDING' && (
                          <Button variant="outline" size="icon">
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {(job.status === 'FAILED' ||
                          job.status === 'CANCELLED') && (
                          <Button variant="outline" size="icon">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
