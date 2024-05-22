import { Test, TestingModule } from '@nestjs/testing';
import { ZoraService } from './zora.service';

describe('ZoraService', () => {
  let service: ZoraService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZoraService],
    }).compile();

    service = module.get<ZoraService>(ZoraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
