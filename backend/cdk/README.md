# デプロイ方法

## 初期設定 & Preinstall

1. AWS の CLI コマンドを使えるようにしておく。

2. Senspace の AWS 環境に接続するために、Profile として Senspace を設定する。

3. npm モジュールのインストール

```
$ yarn
```

## 環境変数設定

example.json を、test.json もしくは main.json としてコピー

```
$ cp ./config/example.json ./config/test.json
```

中身をそれぞれ書き換える。

- dbSecretSuffix については InitStack をつくってから設定するので後で OK

## InitStack のデプロイとその他

InitStack は VPC、DB、踏み台サーバーなどなど

### 踏み台サーバーの pem をつくる

コンソールから作成する。senspace_bastion のような

### コマンド実行

```
$ yarn deploy -c stage=test testGashaInitStack
```

### dbSecretSuffix を設定

DB のシークレット情報を secret manager に保存しているが、ARN の Suffix6 文字が必要なのでコンソールから持ってきて、`config/test.json`などにある`dbSecretSuffix`にいれる。

### Docker Image を push

1. `aws ecr get-login-password --region ap-northeast-1 --profile senspace | docker login --username AWS --password-stdin 726394863183.dkr.ecr.ap-northeast-1.amazonaws.com`
2. `docker build -t gasha-repository:latest -f ./Dockerfile.test .`
3. `docker tag gasha-repository:latest 726394863183.dkr.ecr.ap-northeast-1.amazonaws.com/gasha:latest`
4. `docker push 726394863183.dkr.ecr.ap-northeast-1.amazonaws.com/gasha:latest`

## AppStack のデプロイ

```
$ yarn deploy -c stage=test testGashaAppStack
```
