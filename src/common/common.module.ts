import { Module, Global } from '@nestjs/common';
import { UtilService } from './services/util.service';
import { IdGeneratorService } from './services/id-generator.service';

@Global()
@Module({
  providers: [UtilService, IdGeneratorService],
  exports: [UtilService, IdGeneratorService],
})
export class CommonModule {}
