# zerodha-trading-algorithm
firstly understanding the financial jargon - the order book, limit vs market orders, liquidity and market depth (market makers logic) 
# concept to code
1. In-Memory Order Book: Stored bids and asks directly in arrays (Order[]) within Node.js, mimicking how real exchanges prioritize low latency by keeping the active order book in memory.
2. Matching Logic (fillOrders function): Implemented the core engine. When a new order comes in (e.g., a 'bid'), the code iterates through existing 'asks', checking for price compatibility (asks[i].price <= price), executing trades, handling partial fills, and updating remaining quantities.
3. Balance Updates (flipBalance function): Created logic to accurately adjust user balances (both the asset like 'GOOGLE' and 'USD') after a trade is successfully matched.
4. API Endpoints: Built essential endpoints using Express (/order, /depth, /balance/:userId, /quote) to allow users to place orders, view market depth, check balances, and get quotes – simulating user interaction with an exchange.
