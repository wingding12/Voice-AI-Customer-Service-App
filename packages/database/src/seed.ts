import { prisma } from "./index.js";

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.switchLog.deleteMany();
  await prisma.call.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.knowledgeArticle.deleteMany();

  // Create test customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Jane Smith",
        email: "jane.smith@example.com",
        phone: "+1987654321",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Bob Wilson",
        email: "bob.wilson@example.com",
        phone: "+1555123456",
      },
    }),
  ]);

  console.log(`✅ Created ${customers.length} customers`);

  // Create test orders
  const orders = await Promise.all([
    prisma.order.create({
      data: {
        customerId: customers[0].id,
        status: "DELIVERED",
        total: 149.99,
        items: [
          { id: "1", name: "Wireless Headphones", quantity: 1, price: 99.99 },
          { id: "2", name: "USB-C Cable", quantity: 2, price: 25.0 },
        ],
      },
    }),
    prisma.order.create({
      data: {
        customerId: customers[0].id,
        status: "SHIPPED",
        total: 299.99,
        items: [{ id: "3", name: "Smart Watch", quantity: 1, price: 299.99 }],
      },
    }),
    prisma.order.create({
      data: {
        customerId: customers[1].id,
        status: "PROCESSING",
        total: 79.99,
        items: [
          { id: "4", name: "Bluetooth Speaker", quantity: 1, price: 79.99 },
        ],
      },
    }),
  ]);

  console.log(`✅ Created ${orders.length} orders`);

  // Create knowledge base articles
  const articles = await Promise.all([
    prisma.knowledgeArticle.create({
      data: {
        title: "Return Policy",
        content:
          "We offer a 30-day return policy for all items. Items must be in original packaging and unused condition. To initiate a return, contact customer support with your order number.",
        category: "RETURNS",
      },
    }),
    prisma.knowledgeArticle.create({
      data: {
        title: "Shipping Information",
        content:
          "Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for an additional $15. Free shipping on orders over $100.",
        category: "SHIPPING",
      },
    }),
    prisma.knowledgeArticle.create({
      data: {
        title: "Refund Process",
        content:
          "Refunds are processed within 5-7 business days after we receive the returned item. The refund will be credited to the original payment method.",
        category: "REFUNDS",
      },
    }),
    prisma.knowledgeArticle.create({
      data: {
        title: "Warranty Information",
        content:
          "All electronics come with a 1-year manufacturer warranty. Extended warranty options are available at checkout.",
        category: "WARRANTY",
      },
    }),
  ]);

  console.log(`✅ Created ${articles.length} knowledge articles`);

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
