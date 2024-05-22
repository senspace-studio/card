import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistController } from './allowlist.controller';

describe('AllowlistController', () => {
  let controller: AllowlistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AllowlistController],
    }).compile();

    controller = module.get<AllowlistController>(AllowlistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
