import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as sharp from 'sharp';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { ScorecardEntity } from 'src/entities/scorecard';
import { Repository } from 'typeorm';

const fontRegular = join(
  __dirname,
  '../../assets/fonts/BigelowRules-Regular.ttf',
);

const white = '#FFFFFF';
const yellow = '#FFD700';

const createTextSVG = async (
  text: string,
  width: number,
  height: number,
  color: string,
  textAnchor: 'start' | 'middle' | 'end',
  fontSize: number,
) => {
  return await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(`
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
              <text x="100%" y="50%" dominant-baseline="middle"
                text-anchor="${textAnchor}"
                font-size="${fontSize}"
                fill="${color}"
                font-family="Albert Sans"
              >
                ${text}
              </text>
            </svg>`),
        blend: 'dest-over',
      },
    ])
    .png()
    .toBuffer();
};

type Item = {
  tokenId: number;
  quantity: number;
  point: number;
};

@Injectable()
export class OgpService {
  constructor(
    @InjectRepository(ScorecardEntity)
    private readonly scorecardRepository: Repository<ScorecardEntity>,
  ) {}

  async generateSquareOgp(totalPoint: number, address: string, items: Item[]) {
    const base = readFileSync(
      join(__dirname, '../../assets/images/ogp/square-base.png'),
    );

    const container = sharp(base).resize(1000, 1000);

    const point = await sharp({
      text: {
        text: `<span foreground="${white}" font_weight="bold">${totalPoint}</span>`,
        font: 'Bigelow Rules',
        fontfile: fontRegular,
        rgba: true,
        width: 250,
        height: 64,
      },
    })
      .png()
      .toBuffer();

    const eachQuantity = await Promise.all(
      items.map(async (item, index) => {
        const quantity = item.quantity;
        const input = await sharp({
          text: {
            text: `<span foreground="${white}" font_weight="bold"
            >x ${quantity}</span>`,
            font: 'Bigelow Rules',
            fontfile: fontRegular,
            rgba: true,
            width: 250,
            height: 25,
          },
        })
          .png()
          .toBuffer();
        return {
          input,
          left: 780 - quantity.toString().length * 2,
          top: 120 + index * 42,
        };
      }),
    );

    const eachPoints = await Promise.all(
      items.map(async (item, index) => {
        const input = await sharp({
          text: {
            text: `<span foreground="${white}" font_weight="bold"
            >${item.point}</span>`,
            font: 'Bigelow Rules',
            fontfile: fontRegular,
            rgba: true,
            width: 250,
            height: 25,
          },
        })
          .png()
          .toBuffer();
        return {
          input,
          left: 910 - item.point.toString().length * 5,
          top: 120 + index * 42,
        };
      }),
    );

    const addressImage = await sharp({
      text: {
        text: `<span foreground="white">${
          address.slice(0, 6) + '...' + address.slice(-4)
        }</span>`,
        font: 'Bigelow Rules',
        fontfile: fontRegular,
        rgba: true,
        width: 550,
        height: 40,
        align: 'left',
      },
    })
      .png()
      .toBuffer();

    container.composite([
      ...eachPoints,
      ...eachQuantity,
      {
        input: point,
        left: 700 - totalPoint.toString().length * 15,
        top: 830,
      },
      {
        input: addressImage,
        left: 387,
        top: 764,
      },
    ]);

    const buffer = await container.toBuffer();
    return buffer;
  }

  async getTotalPoint(address: string, totalPoint: number) {
    const base = readFileSync(
      join(__dirname, '../../assets/images/ogp/total-points.png'),
    );

    const container = sharp(base).resize(1000, 1000);

    const addressImage = await sharp({
      text: {
        text: `<span foreground="white">${
          address.slice(0, 6) + '...' + address.slice(-4)
        }</span>`,
        font: 'Bigelow Rules',
        fontfile: fontRegular,
        rgba: true,
        width: 550,
        height: 40,
        align: 'left',
      },
    })
      .png()
      .toBuffer();

    const point = await sharp({
      text: {
        text: `<span foreground="${white}" font_weight="bold">${totalPoint} $Hat</span>`,
        font: 'Bigelow Rules',
        fontfile: fontRegular,
        rgba: true,
        width: 1000,
        height: 180,
      },
    })
      .png()
      .toBuffer();

    container.composite([
      {
        input: addressImage,
        left: 280 - totalPoint.toString().length * 15,
        top: 345,
      },
      {
        input: point,
        left: 290 - totalPoint.toString().length * 15,
        top: 400,
      },
    ]);

    const buffer = await container.toBuffer();
    return buffer;
  }

  async getResult(id: number) {
    const res = await this.scorecardRepository.findOne({ where: { id } });

    return res;
  }

  async saveResult(address: string, result: any[]) {
    // ここで結果を保存する処理を書く
    const res = await this.scorecardRepository.save({
      address,
      result,
      date: Math.ceil(new Date().getTime() / 1000),
    });

    return res;
  }

  async generateChooseOgp(count: number) {
    const base = readFileSync(
      join(__dirname, '../../assets/images/ogp/choose.png'),
    );

    const container = sharp(base).resize(1000, 1000);

    const numoftickets = await sharp({
      text: {
        text: `<span foreground="${white}" font_weight="bold">x ${count}</span>`,
        rgba: true,
        width: 250,
        height: 30,
      },
    })
      .png()
      .toBuffer();

    container.composite([
      {
        input: numoftickets,
        left: 865,
        top: 95,
      },
    ]);

    const buffer = await container.toBuffer();

    return buffer;
  }
}
