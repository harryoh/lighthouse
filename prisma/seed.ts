import {
  PrismaClient,
  SourceType,
  SourceStatus,
  UserRole,
  JobStatus,
  JobType,
  AnalysisType,
} from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@lighthouse.com' },
    update: {},
    create: {
      email: 'admin@lighthouse.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log('✅ Admin user created:', adminUser.email);

  // Create test sources
  const sourceData = [
    {
      name: '조선일보',
      url: 'https://www.chosun.com',
      type: SourceType.NEWS,
      config: {
        selectors: {
          title: '.article-title',
          body: '.article-body',
          author: '.author',
          publishedAt: '.date',
        },
        crawlInterval: 300, // 5 minutes
      },
      status: SourceStatus.ACTIVE,
    },
    {
      name: '한겨레',
      url: 'https://www.hani.co.kr',
      type: SourceType.NEWS,
      config: {
        selectors: {
          title: 'h1.title',
          body: '.article-text',
          author: '.writer',
          publishedAt: '.date-published',
        },
        crawlInterval: 300,
      },
      status: SourceStatus.ACTIVE,
    },
    {
      name: '클리앙',
      url: 'https://www.clien.net',
      type: SourceType.COMMUNITY,
      config: {
        selectors: {
          title: '.post-title',
          body: '.post-content',
          author: '.post-author',
          publishedAt: '.post-time',
        },
        crawlInterval: 600, // 10 minutes
      },
      status: SourceStatus.PAUSED,
    },
  ];

  const sources: any[] = [];
  for (const source of sourceData) {
    const created = await prisma.source.upsert({
      where: { url: source.url },
      update: {},
      create: source,
    });
    sources.push(created);
    console.log(`✅ Source created: ${created.name}`);
  }

  // Create sample content for testing
  const sampleContents = [
    {
      title: '새로운 정책 발표에 대한 여론 조사',
      url: 'https://www.chosun.com/politics/2024/01/sample1',
      body: '정부가 발표한 새로운 경제 정책에 대한 여론 조사 결과가 발표되었다. 전체 응답자의 52%가 긍정적인 반응을 보였으며...',
      author: '김기자',
      publishedAt: new Date('2024-01-15'),
      sourceId: sources[0].id,
      metadata: {
        category: 'politics',
        tags: ['경제', '정책', '여론조사'],
      },
      // We'll add status after creating the content since it's not a direct field
    },
    {
      title: '환경 보호 운동 확산',
      url: 'https://www.hani.co.kr/environment/2024/01/sample2',
      body: '전국적으로 환경 보호 운동이 확산되고 있다. 시민 단체들은 기후 변화에 대응하기 위한 다양한 활동을...',
      author: '이기자',
      publishedAt: new Date('2024-01-16'),
      sourceId: sources[1].id,
      metadata: {
        category: 'environment',
        tags: ['환경', '기후변화', '시민운동'],
      },
      // We'll add status after creating the content since it's not a direct field
    },
  ];

  const createdContents = [];
  for (const content of sampleContents) {
    const { sourceId, metadata, ...contentData } = content;
    const created = await prisma.content.create({
      data: {
        ...contentData,
        rawHtml: `<html><body>${content.body}</body></html>`,
        contentHash: Buffer.from(content.url)
          .toString('base64')
          .substring(0, 32),
        source: {
          connect: { id: sourceId },
        },
      },
    });
    createdContents.push(created);
    console.log(`✅ Sample content created: ${created.title}`);
  }

  // Create sample analysis
  const analysisContent = createdContents[0]; // Use the first created content

  if (analysisContent) {
    await prisma.analysis.create({
      data: {
        contentId: analysisContent.id,
        type: AnalysisType.SENTIMENT,
        result: {
          sentiment: 0.65, // Positive sentiment
          keywords: ['경제', '정책', '여론', '긍정적'],
          entities: [
            { type: 'ORGANIZATION', text: '정부', confidence: 0.95 },
            { type: 'TOPIC', text: '경제 정책', confidence: 0.88 },
          ],
          summary:
            '정부의 새로운 경제 정책에 대한 여론 조사 결과, 과반수 이상이 긍정적 반응을 보임',
          topics: ['경제', '정치', '여론조사'],
          metadata: {
            processingTime: 1250,
            modelVersion: '1.0.0',
            confidence: 0.87,
          },
        },
        score: 0.65,
      },
    });
    console.log('✅ Sample analysis created');
  }

  // Create a test user
  const testUserPassword = await hash('test123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@lighthouse.com' },
    update: {},
    create: {
      email: 'test@lighthouse.com',
      passwordHash: testUserPassword,
      role: UserRole.USER,
    },
  });
  console.log('✅ Test user created:', testUser.email);

  // Create sample jobs
  const jobs = [
    {
      sourceId: sources[0].id,
      type: JobType.CRAWL,
      status: JobStatus.COMPLETED,
      payload: {
        crawledUrls: 25,
        newContent: 10,
        result: {
          success: true,
          itemsProcessed: 25,
          errors: [],
        },
      },
      startedAt: new Date('2024-01-15T10:00:00'),
      completedAt: new Date('2024-01-15T10:05:00'),
    },
    {
      type: JobType.ANALYSIS,
      status: JobStatus.PENDING,
      payload: {
        contentIds: [createdContents[0]?.id || 'unknown'],
        analysisType: 'sentiment',
      },
    },
    {
      sourceId: sources[1].id,
      type: JobType.CRAWL,
      status: JobStatus.RUNNING,
      payload: {
        crawledUrls: 5,
      },
      startedAt: new Date(),
    },
  ];

  for (const job of jobs) {
    const created = await prisma.job.create({
      data: job,
    });
    console.log(`✅ Job created: ${created.type} - ${created.status}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
