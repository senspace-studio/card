import { Test, TestingModule } from '@nestjs/testing';
import { NeynarService } from './neynar.service';

describe('NeynarService', () => {
  let service: NeynarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NeynarService],
    }).compile();

    service = module.get<NeynarService>(NeynarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
