import {Logger, MainInstance, Publisher, InputPublisherModel as PublisherModel, PublisherProtocol} from 'enqueuer';
import {KafkaClient, Producer} from 'kafka-node';

export class KafkaPublisher extends Publisher {
    private readonly kafkaPayload: [{ topic: string; messages: string }];
    private readonly client: KafkaClient;

    constructor(publisherProperties: PublisherModel) {
        super(publisherProperties);

        this.client = new KafkaClient(publisherProperties.client);
        this.kafkaPayload = [
            {topic: publisherProperties.topic, messages: this.payload}
        ];
    }

    public publish(): Promise<any> {
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
                    const args = {message: JSON.stringify(data)};
                    this.executeHookEvent('onPublished', args);
                    this.client.close();
                    resolve(args);

                }
            });

        });
    }
}

export function entryPoint(mainInstance: MainInstance): void {
    const kafka = new PublisherProtocol('kafka',
        (publisherModel: PublisherModel) => new KafkaPublisher(publisherModel),
        {
            homepage: 'https://github.com/enqueuer-land/enqueuer-plugin-kafka',
            description: 'Publisher to handle kafka messages',
            libraryHomepage: 'https://www.npmjs.com/package/kafka-node',
            schema: {
                attributes: {
                    client: {
                        type: 'object',
                        required: true
                    },
                    topic: {
                        type: 'string',
                        required: true
                    },
                    payload: {
                        type: 'any',
                        required: true
                    }
                },
                hooks: {
                    onPublished: {
                        arguments: {
                            message: {}
                        }
                    }
                }
            }
        })
        .setLibrary('kafka-node');
    mainInstance.protocolManager.addProtocol(kafka);
}
