import { Test, TestingModule } from '@nestjs/testing';
import { WarService } from './war.service';

describe('WarService', () => {
  let service: WarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WarService],
    }).compile();

    service = module.get<WarService>(WarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
