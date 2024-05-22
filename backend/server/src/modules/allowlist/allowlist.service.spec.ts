import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistService } from './allowlist.service';

describe('AllowlistService', () => {
  let service: AllowlistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllowlistService],
    }).compile();

    service = module.get<AllowlistService>(AllowlistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
