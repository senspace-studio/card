import { Test, TestingModule } from '@nestjs/testing';
import { OgpService } from './ogp.service';

describe('OgpService', () => {
  let service: OgpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OgpService],
    }).compile();

    service = module.get<OgpService>(OgpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
