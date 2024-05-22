import { Test, TestingModule } from '@nestjs/testing';
import { OgpController } from './ogp.controller';

describe('OgpController', () => {
  let controller: OgpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OgpController],
    }).compile();

    controller = module.get<OgpController>(OgpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
