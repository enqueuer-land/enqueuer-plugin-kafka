import {Logger, MainInstance, Subscription, InputSubscriptionModel as SubscriptionModel, SubscriptionProtocol} from 'enqueuer';
import {KafkaClient, Offset, Message, Consumer} from 'kafka-node';

export class KafkaSubscription extends Subscription {

    private readonly client: KafkaClient;
    private options: any;
    private offset: Offset;
    private latestOffset?: number;

    constructor(subscriptionModel: SubscriptionModel) {
        super(subscriptionModel);

        subscriptionModel.options.requestTimeout = subscriptionModel.options.requestTimeout || 10000;
        subscriptionModel.options.connectTimeout = subscriptionModel.options.connectTimeout || 10000;
        this.options = subscriptionModel.options;
        this.client = new KafkaClient(subscriptionModel.client);
        this.offset = new Offset(this.client);
    }

    public receiveMessage(): Promise<any> {
        return new Promise((resolve, reject) => {
            const consumer = this.createConsumer();
            consumer.on('message', (message: Message) => {
                Logger.trace('Kafka message data: ' + JSON.stringify(message));
                resolve(message);
                consumer.close(() => {
                    Logger.trace('Kafka consumer is closed');
                });
            });

            consumer.on('error', (error: any) => {
                Logger.error('Kafka error message data: ' + JSON.stringify(error));
                reject(error);
                consumer.close(() => {
                    Logger.trace('Kafka consumer is closed');
                });
            });

        });
    }

    public async subscribe(): Promise<void> {
        try {
            this.client.on('error', (err: any) => {
                const message = `Error subscribing to kafka ${JSON.stringify(err)}`;
                Logger.error(message);
                throw message;
            });
            return await this.fetchOffset();
        } catch (exc) {
            const message = `Error connecting kafka ${JSON.stringify(exc)}`;
            Logger.error(message);
            throw message;
        }
    }

    private fetchOffset(): Promise<void> {
        Logger.debug(`Fetching kafka subscription offset`);
        return new Promise((resolve, reject) => {
            try {
                this.offset.fetchLatestOffsets([this.options.topic], async (error: any, offsets: any) => {
                    if (error) {
                        Logger.error(`Error fetching kafka topic ${JSON.stringify(error)}`);
                        reject(error);
                    } else {
                        this.latestOffset = offsets[this.options.topic][0];
                        Logger.trace('Kafka offset fetched');
                        this['ableToUnsubscribe'] = true;
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public async unsubscribe(): Promise<void> {
        if (this.ableToUnsubscribe) {
            this.client.close();
        }
    }

    private createConsumer() {
        return new Consumer(
            this.client,
            [{
                topic: this.options.topic,
                offset: this.latestOffset
            }],
            {
                fromOffset: true
            }
        );
    }

}

export function entryPoint(mainInstance: MainInstance): void {
    const kafka = new SubscriptionProtocol('kafka',
        (subscriptionModel: SubscriptionModel) => new KafkaSubscription(subscriptionModel),
        {onMessageReceived: ['topic', 'value', 'offset', 'partition', 'highWaterOffset', 'key']})
        .setLibrary('kafka-node');
    mainInstance.protocolManager.addProtocol(kafka);
}
