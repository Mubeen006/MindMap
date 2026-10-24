import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() means PrismaService is available in every module
// without needing to import PrismaModule everywhere
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
