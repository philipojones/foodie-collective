import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Copy,
  Clipboard,
  RefreshCw,
  Calendar,
  Trash2,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface OrderItem {
  id: string;
  name: string;
  items: string[];
  timestamp: string;
}

interface FoodCount {
  [key: string]: number;
}

// Pricing structure (same as Index.tsx)
const getPriceForItem = (item: string): number => {
  // Pilau standalone
  if (item === "Pilau") return 4500;
  
  // Chips combinations
  if (item === "Chips") return 2000; // Chips Kavu
  if (item.includes("Chips")) {
    if (item.includes("Mayai")) return 3000;
    if (item.includes("Kidari") || item.includes("Paja")) return 5000;
    return 2000;
  }
  
  // Special item Pande standalone
  if (item === "Pande") return 5500;
  
  // Main + Side combinations
  if (item.includes("+")) {
    // Fish (Sangara) combinations cost more
    if (item.includes("Samaki (Sangara)")) return 5500;
    // Pande combinations
    if (item.includes("Pande")) return 5000
    //wali + Kidari or Wali + Paja combinations
    if (item.includes("Wali") && (item.includes("Kidari") || item.includes("Paja"))) return 5500;
    // All other combinations
    return 4500;
  }
  
  return 0;
};

const Orders = () => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [adminPhrase, setAdminPhrase] = useState("");
  const [foodCounts, setFoodCounts] = useState<FoodCount>({});
  const [loading, setLoading] = useState(true);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  // Calculate total revenue for all orders
  const DELIVERY_FEE = 1000;
  const totalRevenue = orders.reduce((sum, order) => {
    const orderTotal = order.items.reduce((orderSum, item) => orderSum + getPriceForItem(item), 0);
    return sum + orderTotal;
  }, 0) + DELIVERY_FEE;

  const isFromToday = (dateString: string): boolean => {
    const orderDate = new Date(dateString);
    const today = new Date();

    return (
      orderDate.getDate() === today.getDate() &&
      orderDate.getMonth() === today.getMonth() &&
      orderDate.getFullYear() === today.getFullYear()
    );
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Error fetching orders:", error);
        toast({
          title: "Error",
          description: "Failed to load orders. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        // Filter to only show today's orders
        const todaysOrders = data.filter((order) =>
          isFromToday(order.timestamp)
        );
        setOrders(todaysOrders as OrderItem[]);
        updateFoodCounts(todaysOrders as OrderItem[]);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFoodCounts = (orderData: OrderItem[]) => {
    // Calculate food counts
    const counts: FoodCount = {};
    orderData.forEach((order) => {
      order.items.forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });
    });

    setFoodCounts(counts);
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const newOrder = payload.new as OrderItem;

          // Only add the order if it's from today
          if (isFromToday(newOrder.timestamp)) {
            // Add new order to the list
            setOrders((prevOrders) => [newOrder, ...prevOrders]);

            // Update food counts with the new order
            setFoodCounts((prevCounts) => {
              const newCounts = { ...prevCounts };
              newOrder.items.forEach((item) => {
                newCounts[item] = (newCounts[item] || 0) + 1;
              });
              return newCounts;
            });

            // Show notification for new order
            toast({
              title: "New Order Received",
              description: `${newOrder.name} just placed an order`,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("Real-time DELETE event received:", payload);
          const deletedOrderId = payload.old.id;

          // Remove the order from the list
          setOrders((prevOrders) => {
            const updatedOrders = prevOrders.filter(
              (order) => order.id !== deletedOrderId
            );
            updateFoodCounts(updatedOrders);
            return updatedOrders;
          });
        }
      )
      .subscribe();

    // Cleanup function to remove channel subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  const copyOrdersToClipboard = () => {
    let text = "Neurotech.Africa - Food Orders\n\n";

   const DELIVERY_FEE = 1000;

orders.forEach((order, index) => {
  const itemsTotal = order.items.reduce(
    (sum, item) => sum + getPriceForItem(item),
    0
  );

  const orderTotal = itemsTotal + DELIVERY_FEE;

  text += `${index + 1}. ${order.name} - ${formatDate(order.timestamp)}\n`;
  text += `   Items: ${order.items.join(", ")}\n`;
  text += `   Items Total: ${itemsTotal.toLocaleString()}/= TZS\n`;
  text += `   Delivery Fee: ${DELIVERY_FEE.toLocaleString()}/= TZS\n`;
  text += `   Order Total: ${orderTotal.toLocaleString()}/= TZS\n\n`;
});

text += `\nTOTAL SPEND: ${totalRevenue.toLocaleString()}/= TZS`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "All orders have been copied to your clipboard",
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not copy orders to clipboard",
          variant: "destructive",
        });
      });
  };

  const copySummaryToClipboard = () => {
    let text = "Neurotech.Africa - Muhtasari wa Chakula\n\n";

    Object.entries(foodCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .forEach(([item, count]) => {
        text += `${item} ${count}\n`;
      });
    
    text += `\n\nTOTAL ORDERS: ${orders.length}\n`;
    text += `TOTAL SPEND + DELIVERY FEE: ${totalRevenue.toLocaleString()}/= TZS`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Food summary has been copied to your clipboard",
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not copy summary to clipboard",
          variant: "destructive",
        });
      });
  };

  // Function to delete a single order
  const deleteOrder = async (orderId: string, userName: string) => {
    setDeletingOrderId(orderId);

    try {
      console.log(
        `Attempting to delete order: ${orderId} for user: ${userName}`
      );

      const { error, data } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select(); // Add select() to get confirmation of deleted rows

      if (error) {
        console.error("Error deleting order:", error);
        toast({
          title: "Error",
          description: `Failed to delete the order: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log(`Successfully deleted order: ${orderId}`, data);

      toast({
        title: "Order Deleted",
        description: `${userName}'s order has been deleted.`,
      });

      // Update state and food counts together
      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.filter(
          (order) => order.id !== orderId
        );
        console.log(`Updated orders count: ${updatedOrders.length}`);
        updateFoodCounts(updatedOrders);
        return updatedOrders;
      });
    } catch (error) {
      console.error("Unexpected error during deletion:", error);
      toast({
        title: "Error",
        description: "Failed to delete the order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  // Function to delete all orders containing a specific phrase
  const deleteOrdersByPhrase = async () => {
    if (!adminPhrase.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phrase to search for.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleteDialogOpen(false);
    setLoading(true);

    try {
      // First, fetch all orders that contain the phrase
      const { data, error } = await supabase.from("orders").select("*");

      if (error) {
        console.error("Error fetching orders for deletion:", error);
        toast({
          title: "Error",
          description: "Failed to search for orders. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "No Orders Found",
          description: "No orders found matching the specified phrase.",
        });
        setLoading(false);
        return;
      }

      // Filter orders that contain the phrase in any of the items
      const ordersToDelete = data.filter((order) =>
        order.items.some((item) =>
          item.toLowerCase().includes(adminPhrase.toLowerCase())
        )
      );

      if (ordersToDelete.length === 0) {
        toast({
          title: "No Matching Orders",
          description:
            "No orders found with items containing the specified phrase.",
        });
        setLoading(false);
        return;
      }

      // Delete each matching order
      let deletedCount = 0;
      for (const order of ordersToDelete) {
        const { error: deleteError } = await supabase
          .from("orders")
          .delete()
          .eq("id", order.id);

        if (!deleteError) {
          deletedCount++;
        }
      }

      toast({
        title: "Orders Deleted",
        description: `Successfully deleted ${deletedCount} orders containing "${adminPhrase}".`,
      });

      // Refresh orders after bulk deletion
      fetchOrders();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to delete orders. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-4">Today's Food Orders</h1>
          <p className="text-muted-foreground mb-3">
            Orders update in real-time as they are submitted
          </p>
          <p className="text-muted-foreground mb-6 flex items-center justify-center">
            <Calendar className="h-4 w-4 mr-1" />
            <span>Orders reset at midnight each day</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              onClick={copyOrdersToClipboard}
              disabled={orders.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy All Orders
            </Button>

            <Button
              onClick={copySummaryToClipboard}
              disabled={orders.length === 0}
              variant="secondary"
            >
              <Clipboard className="mr-2 h-4 w-4" /> Copy Food Summary
            </Button>

            <Button onClick={fetchOrders} variant="outline" disabled={loading}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </Button>
          </div>

          {/* Admin Delete by Phrase Feature */}
          <div className="mt-4 mb-6">
            <AlertDialog
              open={isDeleteDialogOpen}
              onOpenChange={setIsDeleteDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Lock className="mr-2 h-4 w-4" /> Admin: Delete By Item
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete Orders by Item Phrase
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all orders containing items that match the
                    specified phrase. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Enter item phrase to delete (e.g. 'Ugali')"
                    value={adminPhrase}
                    onChange={(e) => setAdminPhrase(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteOrdersByPhrase}>
                    Delete All Matching Orders
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

        {/* Food Summary Section */}
        {Object.keys(foodCounts).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-morphism rounded-xl p-6 mb-8"
          >
            <h2 className="text-xl font-bold mb-4 text-center">
              Muhtasari wa Chakula
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(foodCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([item, count]) => (
                  <div
                    key={item}
                    className="flex justify-between items-center p-3 border rounded-lg bg-background/50"
                  >
                    <span>{item}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="bg-primary/10 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders Today</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">TOTAL SPEND</p>
                    <p className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString()}/=</p>
                    <p className="text-xs text-muted-foreground">TZS</p>
                  </div>
                </div>
                <div className="text-center pt-2 border-t border-primary/20">
                  <p className="text-xs text-muted-foreground italic">Delivery fee: 1,000/= (constant) Already added on Total Spend</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center p-8">
            <div className="animate-spin mx-auto h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p>Loading orders...</p>
          </div>
        ) : orders.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-morphism rounded-xl p-6 overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const orderTotal = order.items.reduce((sum, item) => sum + getPriceForItem(item), 0);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.name}</TableCell>
                      <TableCell>
                        <ul className="list-disc pl-5">
                          {order.items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {orderTotal.toLocaleString()}/=
                      </TableCell>
                      <TableCell>{formatDate(order.timestamp)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteOrder(order.id, order.name)}
                          disabled={deletingOrderId === order.id}
                        >
                          {deletingOrderId === order.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <div className="text-center p-8 border rounded-lg bg-muted/10">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Orders Today</h3>
            <p className="text-muted-foreground">
              When people submit their orders, they will appear here in
              real-time.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Orders;
