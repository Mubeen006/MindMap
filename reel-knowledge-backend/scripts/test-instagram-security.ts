import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { InstagramMessagingService } from '../src/instagram-messaging/instagram-messaging.service';
import { InstagramCaptureService } from '../src/instagram-bot/instagram-capture.service';

async function runTests() {
  const mockConfig: Record<string, string> = {
    IG_BOT_ACCOUNT_ID: '17841434838918538',
    IG_PERSONAL_ACCOUNT_ID: '17841464186135640',
    ALLOWED_IG_SENDER_IDS: '1383561733743235,1833914544619954,17841464186135640',
    IG_NOTIFY_IGSID: '1383561733743235',
  };

  const sentMessages: Array<{ channel: string; igsid: string; text: string }> = [];
  const enqueuedJobs: any[] = [];

  const mockMessaging = {
    sendMessage: async (channel: string, igsid: string, text: string) => {
      sentMessages.push({ channel, igsid, text });
      return 'msg_123';
    },
  };

  const mockQueue = {
    enqueue: async (data: any) => {
      enqueuedJobs.push(data);
    },
  };

  const prisma = new PrismaService();
  await prisma.$connect();

  const configService = {
    get: (key: string) => mockConfig[key],
  } as unknown as ConfigService;

  const capture = new InstagramCaptureService(
    configService,
    prisma,
    mockQueue as unknown as QueueService,
    mockMessaging as unknown as InstagramMessagingService,
  );

  console.log('--- Test 1: Unauthorized user messages Bot ---');
  sentMessages.length = 0;
  enqueuedJobs.length = 0;
  await capture.handleWebhookEvent({
    object: 'instagram',
    entry: [{
      id: '17841434838918538',
      messaging: [{
        sender: { id: '9999999999999' },
        message: { text: 'https://www.instagram.com/reel/DE_unauthorized/' },
      }],
    }],
  });
  console.log('Sent messages count:', sentMessages.length);
  console.log('Sent message text:', sentMessages[0]?.text);
  console.log('Enqueued jobs:', enqueuedJobs.length);
  if (sentMessages[0]?.text.includes('private and not for public use') && enqueuedJobs.length === 0) {
    console.log('✅ Test 1 PASSED: Unauthorized user was politely rejected!');
  } else {
    console.error('❌ Test 1 FAILED');
  }

  console.log('\n--- Test 2: Creator sends Resource link to Personal Account ---');
  sentMessages.length = 0;
  enqueuedJobs.length = 0;
  await prisma.pendingCapture.deleteMany({ where: { senderIgsid: '1080839174365104' } });

  await capture.handleWebhookEvent({
    object: 'instagram',
    entry: [{
      id: '17841464186135640',
      messaging: [{
        sender: { id: '1080839174365104' },
        message: { text: 'Here is the resource doc: https://docs.google.com/document/d/test123_doc/edit' },
      }],
    }],
  });
  console.log('Sent messages to creator count (MUST BE 0):', sentMessages.length);
  const pending = await prisma.pendingCapture.findFirst({ where: { senderIgsid: '1080839174365104' } });
  console.log('Buffered pending capture url:', pending?.url);
  if (sentMessages.length === 0 && pending?.url?.includes('test123_doc')) {
    console.log('✅ Test 2 PASSED: Resource buffered, NO DM sent to creator!');
  } else {
    console.error('❌ Test 2 FAILED');
  }

  console.log('\n--- Test 3: Owner triggers /done in creator conversation ---');
  sentMessages.length = 0;
  enqueuedJobs.length = 0;

  await capture.handleWebhookEvent({
    object: 'instagram',
    entry: [{
      id: '17841464186135640',
      messaging: [{
        sender: { id: '17841464186135640' },
        recipient: { id: '1080839174365104' },
        message: { text: '/done', is_echo: true },
      }],
    }],
  });

  console.log('Sent messages count:', sentMessages.length);
  console.log('Recipient of message:', sentMessages[0]?.igsid, 'Channel:', sentMessages[0]?.channel);
  console.log('Enqueued job:', enqueuedJobs[0]?.type, enqueuedJobs[0]?.url);
  const remainingPending = await prisma.pendingCapture.findFirst({ where: { senderIgsid: '1080839174365104' } });
  console.log('Remaining pending (should be null):', remainingPending);

  if (
    sentMessages[0]?.channel === 'INSTAGRAM_BOT' &&
    sentMessages[0]?.igsid === '1383561733743235' &&
    enqueuedJobs[0]?.url?.includes('test123_doc') &&
    !remainingPending
  ) {
    console.log('✅ Test 3 PASSED: /done created resource item, notified owner via Bot, cleaned buffer!');
  } else {
    console.error('❌ Test 3 FAILED');
  }

  if (enqueuedJobs[0]?.itemId) {
    await prisma.item.delete({ where: { id: enqueuedJobs[0].itemId } });
  }

  console.log('\n--- Test 4: Owner triggers /done in Bot DM ---');
  await prisma.pendingCapture.create({
    data: {
      senderIgsid: '1080839174365104',
      url: 'https://github.com/example/awesome-agent',
      rawText: 'Check out the repo https://github.com/example/awesome-agent',
    },
  });
  sentMessages.length = 0;
  enqueuedJobs.length = 0;

  await capture.handleWebhookEvent({
    object: 'instagram',
    entry: [{
      id: '17841434838918538',
      messaging: [{
        sender: { id: '1383561733743235' },
        message: { text: '/done' },
      }],
    }],
  });

  console.log('Sent message in Bot chat:', sentMessages[0]?.text);
  console.log('Enqueued job:', enqueuedJobs[0]?.type, enqueuedJobs[0]?.url);

  if (enqueuedJobs[0]?.url === 'https://github.com/example/awesome-agent') {
    console.log('✅ Test 4 PASSED: /done in Bot chat processed buffered pending capture!');
  } else {
    console.error('❌ Test 4 FAILED');
  }

  if (enqueuedJobs[0]?.itemId) {
    await prisma.item.delete({ where: { id: enqueuedJobs[0].itemId } });
  }

  await prisma.$disconnect();
  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
