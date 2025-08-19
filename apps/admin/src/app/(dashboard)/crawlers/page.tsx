'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Plus,
  Settings,
  Globe,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';

// Mock crawler data
const crawlers = [
  {
    id: '1',
    name: 'Naver News Crawler',
    url: 'https://news.naver.com',
    type: 'NEWS',
    status: 'ACTIVE',
    lastRun: '2024-01-15 14:30',
    nextRun: '2024-01-15 15:00',
    config: {
      interval: '30 minutes',
      depth: 3,
      maxPages: 100,
    },
    stats: {
      total: 12456,
      today: 234,
      success: 98.5,
    },
  },
  {
    id: '2',
    name: 'Daum Blog Crawler',
    url: 'https://blog.daum.net',
    type: 'BLOG',
    status: 'PAUSED',
    lastRun: '2024-01-15 12:00',
    nextRun: '-',
    config: {
      interval: '1 hour',
      depth: 2,
      maxPages: 50,
    },
    stats: {
      total: 8934,
      today: 0,
      success: 97.2,
    },
  },
  {
    id: '3',
    name: 'Twitter Crawler',
    url: 'https://twitter.com',
    type: 'SOCIAL',
    status: 'ERROR',
    lastRun: '2024-01-15 13:45',
    nextRun: '-',
    config: {
      interval: '15 minutes',
      depth: 1,
      maxPages: 200,
    },
    stats: {
      total: 45678,
      today: 567,
      success: 95.3,
    },
  },
  {
    id: '4',
    name: 'DC Inside Crawler',
    url: 'https://www.dcinside.com',
    type: 'COMMUNITY',
    status: 'MAINTENANCE',
    lastRun: '2024-01-15 10:00',
    nextRun: '-',
    config: {
      interval: '2 hours',
      depth: 2,
      maxPages: 75,
    },
    stats: {
      total: 6789,
      today: 123,
      success: 96.8,
    },
  },
];

const statusColors: Record<string, any> = {
  ACTIVE: { bg: 'bg-green-500', text: 'text-green-500', icon: CheckCircle },
  PAUSED: { bg: 'bg-yellow-500', text: 'text-yellow-500', icon: AlertCircle },
  ERROR: { bg: 'bg-red-500', text: 'text-red-500', icon: XCircle },
  MAINTENANCE: { bg: 'bg-gray-500', text: 'text-gray-500', icon: Settings },
};

export default function CrawlersPage() {
  const toggleCrawler = (crawler: any) => {
    // Toggle crawler status logic here
    console.log('Toggling crawler:', crawler.name);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Crawlers</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your web crawlers
          </p>
        </div>
        <Button variant="gradient">
          <Plus className="w-4 h-4 mr-2" />
          Add Crawler
        </Button>
      </div>

      {/* Crawler Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card glass>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Crawlers</p>
                <p className="text-2xl font-bold">{crawlers.length}</p>
              </div>
              <Globe className="w-8 h-8 text-violet-500" />
            </div>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">
                  {crawlers.filter((c) => c.status === 'ACTIVE').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Errors</p>
                <p className="text-2xl font-bold text-red-500">
                  {crawlers.filter((c) => c.status === 'ERROR').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pages Today</p>
                <p className="text-2xl font-bold">
                  {crawlers.reduce((sum, c) => sum + c.stats.today, 0)}
                </p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crawlers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {crawlers.map((crawler) => {
          const StatusIcon = statusColors[crawler.status].icon;
          return (
            <div key={crawler.id}>
              <Card glass>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {crawler.name}
                        <StatusIcon
                          className={`w-5 h-5 ${
                            statusColors[crawler.status].text
                          }`}
                        />
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {crawler.url}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleCrawler(crawler)}
                      >
                        {crawler.status === 'ACTIVE' ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium text-white rounded ${
                        statusColors[crawler.status].bg
                      }`}
                    >
                      {crawler.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Type: {crawler.type}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Pages
                      </p>
                      <p className="text-lg font-semibold">
                        {crawler.stats.total.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-lg font-semibold">
                        {crawler.stats.today}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Success Rate
                      </p>
                      <p className="text-lg font-semibold">
                        {crawler.stats.success}%
                      </p>
                    </div>
                  </div>

                  {/* Configuration */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Interval:</span>
                      <span>{crawler.config.interval}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Depth:</span>
                      <span>{crawler.config.depth}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Pages:</span>
                      <span>{crawler.config.maxPages}</span>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-white/10">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last: {crawler.lastRun}
                    </span>
                    <span>Next: {crawler.nextRun}</span>
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
