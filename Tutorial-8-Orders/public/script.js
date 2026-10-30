async function loadOrders() {
  const orderList = document.getElementById("orderList");

  orderList.textContent = "Loading orders...";

  try {
    const response = await fetch("/orders");

    if (!response.ok) {
      throw new Error("Failed to load orders");
    }

    const orders = await response.json();

    orderList.innerHTML = "";

    if (orders.length === 0) {
      orderList.textContent = "No orders available.";

      return;
    }

    orders.forEach((order) => {
      const card = document.createElement("div");
      card.className = "order-card";

      const info = document.createElement("div");
      info.className = "order-info";

      const heading = document.createElement("h3");
      heading.textContent = `Order #${order.id}`;

      const item = document.createElement("p");
      item.textContent = order.item;

      const price = document.createElement("p");
      price.textContent = `Price: Rs. ${order.price}`;

      info.append(heading, item, price);

      const actions = document.createElement("div");
      actions.className = "order-actions";

      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.className = "edit-btn";

      editButton.addEventListener("click", () => {
        editOrder(order.id, order.item, order.price);
      });

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-btn";

      deleteButton.addEventListener("click", () => {
        deleteOrder(order.id);
      });

      actions.append(editButton, deleteButton);

      card.append(info, actions);

      orderList.appendChild(card);
    });
  } catch (error) {
    orderList.textContent = error.message;
  }
}

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const item = document.getElementById("item").value.trim();

  const price = document.getElementById("price").value;

  const message = document.getElementById("message");

  try {
    const response = await fetch("/orders", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        item: item,
        price: Number(price),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not create order");
    }

    message.textContent = "Order created successfully!";

    e.target.reset();

    loadOrders();
  } catch (error) {
    message.textContent = error.message;
  }
});

async function editOrder(id, oldItem, oldPrice) {
  const newItem = prompt("Enter updated food item:", oldItem);

  if (newItem === null) return;

  const newPrice = prompt("Enter updated price:", oldPrice);

  if (newPrice === null) return;

  if (
    !newItem.trim() ||
    newPrice.trim() === "" ||
    !Number.isFinite(Number(newPrice)) ||
    Number(newPrice) < 0
  ) {
    alert("Please enter a valid item name and price.");

    return;
  }

  try {
    const response = await fetch(`/orders/${id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        item: newItem.trim(),
        price: Number(newPrice),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Update failed");
    }

    alert("Order updated successfully!");

    loadOrders();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteOrder(id) {
  const confirmDelete = confirm(
    `Are you sure you want to delete Order #${id}?`,
  );

  if (!confirmDelete) return;

  try {
    const response = await fetch(`/orders/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Delete failed");
    }

    alert("Order deleted successfully!");

    loadOrders();
  } catch (error) {
    alert(error.message);
  }
}

loadOrders();
