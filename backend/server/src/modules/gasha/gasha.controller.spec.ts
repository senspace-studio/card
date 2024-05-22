import { Test, TestingModule } from '@nestjs/testing';
import { GashaController } from './gasha.controller';

describe('GashaController', () => {
  let controller: GashaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GashaController],
    }).compile();

    controller = module.get<GashaController>(GashaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
