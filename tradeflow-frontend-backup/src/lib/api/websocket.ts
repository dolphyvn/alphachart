type MessageHandler = (data: any) => void;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectInterval: number = 3000;
    private handlers: Set<MessageHandler> = new Set();
    private subscriptions: Set<string> = new Set();

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (this.ws) return;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            // Resubscribe to symbols
            if (this.subscriptions.size > 0) {
                this.send({
                    action: 'subscribe',
                    symbols: Array.from(this.subscriptions)
                });
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handlers.forEach(handler => handler(data));
            } catch (e) {
                console.error('Failed to parse WebSocket message', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting...');
            this.ws = null;
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.ws?.close();
        };
    }

    subscribe(symbols: string[]) {
        symbols.forEach(s => this.subscriptions.add(s));
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({
                action: 'subscribe',
                symbols
            });
        }
    }

    unsubscribe(symbols: string[]) {
        symbols.forEach(s => this.subscriptions.delete(s));
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({
                action: 'unsubscribe',
                symbols
            });
        }
    }

    addMessageHandler(handler: MessageHandler) {
        this.handlers.add(handler);
    }

    removeMessageHandler(handler: MessageHandler) {
        this.handlers.delete(handler);
    }

    private send(data: any) {
        this.ws?.send(JSON.stringify(data));
    }
}

export const wsClient = new WebSocketClient(process.env.NEXT_PUBLIC_WS_URL || 'ws://ns3366383.ip-37-187-77.eu:8001/api/v1/ws/stream');
