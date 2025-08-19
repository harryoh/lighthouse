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
  Activity,
  FileText,
  Globe,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Play,
} from 'lucide-react';
// framer-motion removed
// Temporarily comment out recharts to test build
// import {
//   AreaChart,
//   Area,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell
// } from 'recharts'

// Mock data for charts (temporarily commented out)
// const crawlingData = [
//   { time: '00:00', pages: 120 },
//   { time: '04:00', pages: 230 },
//   { time: '08:00', pages: 450 },
//   { time: '12:00', pages: 780 },
//   { time: '16:00', pages: 920 },
//   { time: '20:00', pages: 1100 },
//   { time: '24:00', pages: 1250 },
// ]

// const contentTypes = [
//   { name: 'News', value: 45, color: '#8B5CF6' },
//   { name: 'Blog', value: 30, color: '#3B82F6' },
//   { name: 'Social', value: 20, color: '#06B6D4' },
//   { name: 'Community', value: 5, color: '#10B981' },
// ]

const statsCards = [
  {
    title: 'Total Contents',
    value: '12,345',
    change: '+12.5%',
    trend: 'up',
    icon: FileText,
    gradient: 'from-violet-600 to-purple-600',
  },
  {
    title: 'Active Crawlers',
    value: '8',
    change: '+2',
    trend: 'up',
    icon: Globe,
    gradient: 'from-blue-600 to-cyan-600',
  },
  {
    title: 'Running Jobs',
    value: '24',
    change: '-3',
    trend: 'down',
    icon: Briefcase,
    gradient: 'from-emerald-600 to-green-600',
  },
  {
    title: 'Success Rate',
    value: '98.5%',
    change: '+0.8%',
    trend: 'up',
    icon: Activity,
    gradient: 'from-orange-600 to-red-600',
  },
];

const recentActivities = [
  {
    id: 1,
    type: 'crawl',
    source: 'Naver News',
    status: 'completed',
    time: '2 min ago',
  },
  {
    id: 2,
    type: 'analysis',
    source: 'Daum Blog',
    status: 'running',
    time: '5 min ago',
  },
  {
    id: 3,
    type: 'crawl',
    source: 'Twitter',
    status: 'failed',
    time: '10 min ago',
  },
  {
    id: 4,
    type: 'export',
    source: 'Database',
    status: 'completed',
    time: '15 min ago',
  },
  {
    id: 5,
    type: 'crawl',
    source: 'DC Inside',
    status: 'running',
    time: '20 min ago',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of your crawling operations
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="gradient" size="sm">
            <Play className="w-4 h-4 mr-2" />
            Start All Crawlers
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <div key={stat.title}>
            <Card glass>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div
                  className={`p-2 rounded-lg bg-gradient-to-r ${stat.gradient}`}
                >
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center mt-2">
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-xs ml-1 ${
                      stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    from last hour
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crawling Activity Chart */}
        <div className="lg:col-span-2">
          <Card glass>
            <CardHeader>
              <CardTitle>Crawling Activity</CardTitle>
              <CardDescription>
                Pages crawled over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Chart temporarily disabled for build testing */}
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Chart placeholder
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Types Pie Chart */}
        <div>
          <Card glass>
            <CardHeader>
              <CardTitle>Content Types</CardTitle>
              <CardDescription>Distribution by source type</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pie chart temporarily disabled for build testing */}
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Pie chart placeholder
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <Card glass>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest crawling and analysis operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activity.status === 'completed'
                          ? 'bg-green-500'
                          : activity.status === 'running'
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">{activity.source}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.type.charAt(0).toUpperCase() +
                          activity.type.slice(1)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium capitalize">
                      {activity.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
