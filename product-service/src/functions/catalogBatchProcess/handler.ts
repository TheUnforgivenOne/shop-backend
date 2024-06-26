import { SQSHandler } from 'aws-lambda';
import { SNSClient, PublishCommand, MessageAttributeValue } from '@aws-sdk/client-sns';
import { v4 as uuid } from 'uuid';
import dbClient from '../../dbClient';
import { Product, Stock } from '../../types';
import isValidProduct from '../../utils/isValidProduct';

const snsClient = new SNSClient({ region: 'eu-west-1' });

export const catalogBatchProcess: SQSHandler = async (event) => {
  const results = [];

  for (let record of event.Records) {
    try {
      const params = JSON.parse(record.body);

      if (!isValidProduct(params)) results.push('Product validation error');

      const { count, ...productData } = params;

      const id = uuid();
      const product: Product = { id, ...productData, imgUrl: '' };
      const stock: Stock = { product_id: id, count };

      await dbClient.createProduct(product, stock);

      results.push(`Product ${product.title} imported`);
    } catch (e) {
      console.log(e);
      results.push('Error while import product, check console');
    }
  }

  const message = 'Following products was imported\n' + results.join('\n');
  const importStatus = results.every((res: string) => !res.toLowerCase().includes('error')) ? 'OK' : 'WARNING';

  const pubCommand = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: 'Products import',
    Message: message,
    MessageAttributes: {
      importStatus: {
        DataType: 'String',
        StringValue: importStatus,
      },
    },
  });
  await snsClient.send(pubCommand);
};
