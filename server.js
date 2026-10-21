// server.js -- the CampusEats Catalogue GraphQL API
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLError } = require('graphql');
const pool = require('./db');

// Column lists: SQL aliases rename snake_case columns to the camelCase GraphQL field names,
// so that once a row is loaded its scalar fields resolve automatically.
const OUTLET_COLS = 'outlet_id AS id, name, address, phone, is_active AS isActive';
const ITEM_COLS =
  'menu_item_id AS id, outlet_id AS outletId, name, description, price, is_available AS isAvailable';

// 1. the schema: what the API offers
const typeDefs = `#graphql
  type Outlet {
    id: ID!
    name: String!
    address: String!
    phone: String
    isActive: Boolean!
    menuItems: [MenuItem!]!
  }

  type MenuItem {
    id: ID!
    name: String!
    description: String
    price: Float!
    isAvailable: Boolean!
    outlet: Outlet!
  }

  type Query {
    outlets: [Outlet!]!
    outlet(id: ID!): Outlet
    menuItems: [MenuItem!]!
  }

  type Mutation {
    addMenuItem(outletId: ID!, name: String!, description: String, price: Float!): MenuItem!
  }
`;

// 2. the resolvers: how each field gets its data from MySQL
const resolvers = {
  Query: {
    outlets: async () => {
      const [rows] = await pool.query(`SELECT ${OUTLET_COLS} FROM outlets ORDER BY outlet_id`);
      return rows;
    },
    outlet: async (_parent, { id }) => {
      const [rows] = await pool.query(`SELECT ${OUTLET_COLS} FROM outlets WHERE outlet_id = ?`, [id]);
      return rows[0] || null;
    },
    menuItems: async () => {
      const [rows] = await pool.query(`SELECT ${ITEM_COLS} FROM menu_items ORDER BY menu_item_id`);
      return rows;
    },
  },

  // relationship fields -- these are the ones you must write
  Outlet: {
    menuItems: async (outlet) => {
      const [rows] = await pool.query(
        `SELECT ${ITEM_COLS} FROM menu_items WHERE outlet_id = ? ORDER BY menu_item_id`,
        [outlet.id]
      );
      return rows;
    },
  },
  MenuItem: {
    outlet: async (item) => {
      const [rows] = await pool.query(`SELECT ${OUTLET_COLS} FROM outlets WHERE outlet_id = ?`, [
        item.outletId,
      ]);
      return rows[0];
    },
  },

  Mutation: {
    addMenuItem: async (_parent, { outletId, name, description, price }) => {
      const cleanName = name.trim();
      if (!cleanName) {
        throw new GraphQLError('name must not be empty', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!(price > 0)) {
        throw new GraphQLError('price must be greater than 0', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const [outlets] = await pool.query('SELECT outlet_id FROM outlets WHERE outlet_id = ?', [
        outletId,
      ]);
      if (outlets.length === 0) {
        throw new GraphQLError(`outlet ${outletId} does not exist`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      const [result] = await pool.query(
        'INSERT INTO menu_items (outlet_id, name, description, price) VALUES (?, ?, ?, ?)',
        [outletId, cleanName, description || null, price]
      );
      const [rows] = await pool.query(`SELECT ${ITEM_COLS} FROM menu_items WHERE menu_item_id = ?`, [
        result.insertId,
      ]);
      return rows[0];
    },
  },
};

// 3. start the server
async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
  console.log(`GraphQL API ready at ${url}`);
}

start();
