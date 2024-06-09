import { Test, TestingModule } from '@nestjs/testing';
import { WarController } from './war.controller';

describe('WarController', () => {
  let controller: WarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarController],
    }).compile();

    controller = module.get<WarController>(WarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
