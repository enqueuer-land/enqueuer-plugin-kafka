import {Logger, MainInstance, Publisher, PublisherModel, PublisherProtocol} from 'enqueuer-plugins-template';
import {KafkaClient, Producer} from 'kafka-node';

export class KafkaPublisher extends Publisher {
    private readonly kafkaPayload: [{ topic: string; messages: string }];
    private readonly client: KafkaClient;

    constructor(publisherProperties: PublisherModel) {
        super(publisherProperties);

        this.client = new KafkaClient(publisherProperties.client);
        this.kafkaPayload = [
            { topic: publisherProperties.topic, messages: this.payload }
        ];
    }

    public publish(): Promise<void> {
        return new Promise((resolve, reject) => {
            const producer = new Producer(this.client);
            Logger.trace(`Waiting for kafka publisher client connection`);
            producer.on('error', async (err: any) => {
                Logger.error(`Error on publishing kafka message ${JSON.stringify(err)}`);
                producer.close();
                this.client.close();
                reject(err);
            });

            Logger.trace(`Kafka publisher is ready`);
            producer.send(this.kafkaPayload, (err, data) => {
                if (err) {
                    Logger.error(`Error sending kafka message ${JSON.stringify(err)}`);
                    reject(err);
                } else {
                    producer.close();
                    this.onSend(data, resolve);
                }
            });

        });
    }

    private onSend(data: any, resolve: any) {
        this.messageReceived = JSON.stringify(data);
        this.client.close();
        resolve();
    }

}

export function entryPoint(mainInstance: MainInstance): void {
    const kafka = new PublisherProtocol('kafka',
        (publisherModel: PublisherModel) => new KafkaPublisher(publisherModel))
        .setLibrary('kafka-node');
    mainInstance.protocolManager.addProtocol(kafka);
}
