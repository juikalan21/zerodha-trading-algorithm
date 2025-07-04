import express from "express";
import bodyParser from "body-parser";
export const app = express();

app.use(bodyParser({}));

interface Balances { 
  [key: string]: number; //object which maps your balance for asset
}

interface User {
  id: string; //username, firstname, etc
  balances: Balances; //every user has a bunch of balances associated things like 10 stocks of xyx
};

interface Order { //how would you store and order that a user places -> limit order at this price and quantity, the order object updates as the price gets increasing
  userId: string;
  price: number;
  quantity: number;
}

export const TICKER = "GOOGLE"; //current ticker (single marker) - array

const users: User[] = [{
  id: "1",
  balances: {
    "GOOGLE": 10,
    "USD": 50000
  }
}, {
  id: "2",
  balances: {
    "GOOGLE": 10,
    "USD": 50000
  }
}];

//in memory objects - most exchanges that need to support low latency store order books in memory - literally just variables.
const bids: Order[] = []; //array of orders - 
const asks: Order[] = [];

// Place a limit order - writing a orderbook that can store orders and match them
app.post("/order", (req: any, res: any) => {
  const side: string = req.body.side; //buy or sell/bid or ask
  const price: number = req.body.price;
  const quantity: number = req.body.quantity;
  const userId: string = req.body.userId; //in real world we will get userId from the cookie session or JWT token

  //when an order comes in, i first need to check can this order be filled in the existing order book and get back the remaining quantity
  const remainingQty = fillOrders(side, price, quantity, userId);

  if (remainingQty === 0) { //order has been filled
    res.json({ filledQuantity: quantity });
    return;
  }

  if (side === "bid") {
    bids.push({
      userId,
      price,
      quantity: remainingQty
    });
    bids.sort((a, b) => a.price < b.price ? -1 : 1); //sorting because eventually we want to match the oders 
  } else {
    asks.push({
      userId,
      price,
      quantity: remainingQty
    })
    asks.sort((a, b) => a.price < b.price ? 1 : -1);
  }

  res.json({
    filledQuantity: quantity - remainingQty,
  })
})

//needs to return the current order book - cumilating the orders
app.get("/depth", (req: any, res: any) => {
  const depth: {
    [price: string]: {
      type: "bid" | "ask",
      quantity: number,
    }
  } = {};

  for (let i = 0; i < bids.length; i++) {
    if (!depth[bids[i].price]) {
      depth[bids[i].price] = {
        quantity: bids[i].quantity,
        type: "bid"
      };
    } else {
      depth[bids[i].price].quantity += bids[i].quantity; //if the price is already in the order book, we just add the quantity to it
    }
  }

  for (let i = 0; i < asks.length; i++) {
    if (!depth[asks[i].price]) {
      depth[asks[i].price] = {
        quantity: asks[i].quantity,
        type: "ask"
      }
    } else {
      depth[asks[i].price].quantity += asks[i].quantity;
    }
  }

  res.json({
    depth
  })
})

//how much balances the user has - both USD and ticker - google stock here
app.get("/balance/:userId", (req, res) => {
  const userId = req.params.userId;
  const user = users.find(x => x.id === userId);
  if (!user) {
    return res.json({
      USD: 0,
      [TICKER]: 0
    })
  }
  res.json({ balances: user.balances }); //return the balance of user
})
//quote - how much will it cost to buy/sell a certain quantity of stock - this is the price that the user will see when they place an order
app.get("/quote", (req, res) => {
  const side = req.body.side;
  const quantity = req.body.quantity;
  let total_price = 0;
  let curr_quantity = quantity;

  if (side === "bid") {
    for (let i = 0; i < asks.length; i++) {
      if (asks[i].quantity >= curr_quantity) {
        total_price += asks[i].price * curr_quantity;
        curr_quantity = 0;
        break;
      } else {
        total_price += asks[i].price * asks[i].quantity;
        curr_quantity -= asks[i].quantity;
      }
    }
  } else if (side === "ask") {
    for (let i = 0; i < bids.length; i++) {
      if (bids[i].quantity >= curr_quantity) {
        total_price += bids[i].price * curr_quantity;
        curr_quantity = 0;
        break;
      } else {
        total_price += bids[i].price * bids[i].quantity;
        curr_quantity -= bids[i].quantity;
      }
    }
  }

  const quote = total_price / quantity;

  res.json({ quote });
});

function flipBalance(userId1: string, userId2: string, quantity: number, price: number) {
  let user1 = users.find(x => x.id === userId1);
  let user2 = users.find(x => x.id === userId2);
  if (!user1 || !user2) {
    return;
  }
  //swap 
  user1.balances[TICKER] -= quantity; //decrease the quantiy of stock for first user
  user2.balances[TICKER] += quantity; //add for second user
  user1.balances["USD"] += (quantity * price); //added to first user
  user2.balances["USD"] -= (quantity * price); //removed from second user
}

function fillOrders(side: string, price: number, quantity: number, userId: string): number {
  let remainingQuantity = quantity;
  if (side === "bid") {
    //when someone places a bid order, we need to check if there are any asks that can be filled at the price - matching with asks - returning the remaining quantity
    for (let i = asks.length - 1; i >= 0; i--) {
      if (asks[i].price > price) {
        continue;
      }
      if (asks[i].quantity > remainingQuantity) {
        asks[i].quantity -= remainingQuantity;
        flipBalance(asks[i].userId, userId, remainingQuantity, asks[i].price);
        return 0;
      } else {
        remainingQuantity -= asks[i].quantity;
        flipBalance(asks[i].userId, userId, asks[i].quantity, asks[i].price);
        asks.pop(); //remove the order from the order book because the ask is filled
      }
    }
  } else {
    for (let i = bids.length - 1; i >= 0; i--) {
      if (bids[i].price < price) {
        continue;
      }
      if (bids[i].quantity > remainingQuantity) {
        bids[i].quantity -= remainingQuantity;
        flipBalance(userId, bids[i].userId, remainingQuantity, price);
        return 0;
      } else {
        remainingQuantity -= bids[i].quantity;
        flipBalance(userId, bids[i].userId, bids[i].quantity, price);
        bids.pop();
      }
    }
  }

  return remainingQuantity;
}