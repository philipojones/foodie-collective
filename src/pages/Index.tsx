import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MenuCard from "@/components/MenuCard";
import OrderSummary from "@/components/OrderSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Star, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const mainDishes = [
  "Ugali",
  "Wali",
  "Pilau",
  "Chips",
];

const sides = [
  "Nyama",
  "Maini",
  "Utumbo",
  "Dagaa",
  "Njegere",
  "Kokoto",
  "Samaki (Sangara)",
  "Mayai",
  "Kidari",
  "Paja",
];

// Pricing structure
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
    
    // Pande combinations
    if (item.includes("Pande")) return 5500;

    // All other combinations
    return 4500;
  }
  
  return 0;
};

// Generate all possible combinations for order of the day
const menuItems = mainDishes.flatMap((main) =>
  sides.map((side) => `${main} + ${side}`)
);

// Get a random menu item for the order of the day
const getOrderOfTheDay = () => {
  const date = new Date();
  // Use the day of the month to select an item (ensures consistency for the day)
  const dayOfMonth = date.getDate();
  const index = dayOfMonth % menuItems.length;
  return menuItems[index];
};

const orderOfTheDay = getOrderOfTheDay();

const Index = () => {
  const [selectedMain, setSelectedMain] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<string>("");
  const [name, setName] = useState("");
  const [alreadyOrdered, setAlreadyOrdered] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Calculate total cost based on combination
  const getCombinationPrice = () => {
    if (!selectedMain && !selectedSide) return 0;
    
    // If both selected, create combination
    if (selectedMain && selectedSide) {
      const combination = `${selectedMain} + ${selectedSide}`;
      return getPriceForItem(combination);
    }
    
    // If only main selected
    if (selectedMain) return getPriceForItem(selectedMain);
    
    // If only side selected
    if (selectedSide) return getPriceForItem(selectedSide);
    
    return 0;
  };
  
  const totalCost = getCombinationPrice();
  const selectedItems = selectedMain && selectedSide ? [`${selectedMain} + ${selectedSide}`] : selectedMain === "Pilau" ? ["Pilau"] : [];
  
  // Filter available sides based on main dish
  const availableSides = selectedMain === "Chips" 
    ? sides.filter(side => ["Mayai", "Kidari", "Paja"].includes(side))
    : selectedMain === "Pilau"
    ? [] // No sides available for Pilau
    : (selectedMain === "Ugali" || selectedMain === "Wali")
    ? sides.filter(side => !["Mayai", "Kidari", "Paja", "Samaki (Sangara)"].includes(side))
    : sides;

  useEffect(() => {
    // Check if user has already ordered today
    const checkExistingOrder = async () => {
      setCheckingOrder(true);

      // First try to get the name from localStorage
      const storedName = localStorage.getItem("neurotech-name");
      if (storedName) {
        setName(storedName);

        // Check if this user has already placed an order today
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { data, error } = await supabase
            .from("orders")
            .select("id, items")
            .eq("name", storedName)
            .gte("timestamp", today.toISOString())
            .order("timestamp", { ascending: false })
            .limit(1);

          if (error) {
            console.error("Error checking existing order:", error);
          } else if (data && data.length > 0) {
            setAlreadyOrdered(true);
            setExistingOrderId(data[0].id);
            // Pre-fill the selected items with the existing order
            if (data[0].items && data[0].items.length > 0) {
              const orderItem = data[0].items[0];
              if (orderItem.includes(" + ")) {
                const [main, side] = orderItem.split(" + ");
                setSelectedMain(main);
                setSelectedSide(side);
              }
            }
          }
        } catch (error) {
          console.error("Error:", error);
        }
      }

      setCheckingOrder(false);
    };

    checkExistingOrder();
  }, []);

  const handleMainDishClick = (dish: string) => {
    if (selectedMain === dish) {
      setSelectedMain("");
    } else {
      // If switching to Pilau, clear side and show message
      if (dish === "Pilau" && selectedSide) {
        setSelectedSide("");
        toast({
          title: "Pilau is standalone",
          description: "Pilau is served alone without sides (4,000/=)",
        });
      }
      // If switching to Chips and current side is not valid for Chips, clear side
      else if (dish === "Chips" && selectedSide && !["Mayai", "Kidari", "Paja"].includes(selectedSide)) {
        setSelectedSide("");
        toast({
          title: "Side cleared",
          description: "Chips can only be combined with Mayai, Kidari, or Paja",
        });
      }
      // If switching to Ugali or Wali and restricted side is selected, clear side
      else if ((dish === "Ugali" || dish === "Wali") && ["Mayai", "Kidari", "Paja", "Samaki (Sangara)"].includes(selectedSide)) {
        setSelectedSide("");
        toast({
          title: "Side cleared",
          description: "Ugali and Wali cannot be combined with Mayai, Kidari, Paja, or Samaki",
        });
      }
      setSelectedMain(dish);
    }
  };

  const handleSideClick = (side: string) => {
    // Check if trying to select side with Pilau
    if (selectedMain === "Pilau") {
      toast({
        title: "Invalid combination",
        description: "Pilau is served alone without sides (4,000/=)",
        variant: "destructive",
      });
      return;
    }
    
    // Check if trying to select invalid combination with Chips
    if (selectedMain === "Chips" && !["Mayai", "Kidari", "Paja"].includes(side)) {
      toast({
        title: "Invalid combination",
        description: "Chips can only be combined with Mayai, Kidari, or Paja",
        variant: "destructive",
      });
      return;
    }
    
    // Check if trying to select restricted sides with Ugali or Wali
    if ((selectedMain === "Ugali" || selectedMain === "Wali") && ["Mayai", "Kidari", "Paja", "Samaki (Sangara)"].includes(side)) {
      toast({
        title: "Invalid combination",
        description: "Ugali and Wali cannot be combined with Mayai, Kidari, Paja, or Samaki",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedSide === side) {
      setSelectedSide("");
    } else {
      setSelectedSide(side);
    }
  };

  const handleRemoveItem = (item: string) => {
    setSelectedMain("");
    setSelectedSide("");
  };

  const handleAddOrderOfTheDay = () => {
    const currentSelection = selectedMain && selectedSide ? `${selectedMain} + ${selectedSide}` : "";
    
    if (currentSelection === orderOfTheDay) {
      toast({
        title: "Already in your order",
        description: `${orderOfTheDay} is already in your selection`,
        variant: "destructive",
      });
      return;
    }
    
    // Parse the order of the day and set main and side
    if (orderOfTheDay.includes(" + ")) {
      const [main, side] = orderOfTheDay.split(" + ");
      setSelectedMain(main);
      setSelectedSide(side);
      toast({
        title: "Added to your order",
        description: `${orderOfTheDay} has been added to your selection`,
      });
    }
  };

  const handleResetOrder = () => {
    setAlreadyOrdered(false);
    setExistingOrderId(null);
    setSelectedMain("");
    setSelectedSide("");
    toast({
      title: "Order Reset",
      description: "You can now place a new order for today",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return; // Prevent multiple submissions

    if (!name.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter your name to continue",
        variant: "destructive",
      });
      return;
    }

    // Pilau can be submitted alone, others need a side
    if (!selectedMain || (selectedMain !== "Pilau" && !selectedSide)) {
      toast({
        title: "Incomplete order",
        description: selectedMain === "Pilau" ? "Please select Pilau" : "Please select one main dish and one side",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Save name to localStorage for future use
      localStorage.setItem("neurotech-name", name);

      const orderItems = selectedMain === "Pilau" ? ["Pilau"] : [`${selectedMain} + ${selectedSide}`];
      let operation;

      if (alreadyOrdered && existingOrderId) {
        // Update existing order
        operation = supabase
          .from("orders")
          .update({
            items: orderItems,
            timestamp: new Date().toISOString(), // Update timestamp to current time
          })
          .eq("id", existingOrderId);
      } else {
        // Insert new order
        operation = supabase.from("orders").insert({
          name,
          items: orderItems,
        });
      }

      const { error } = await operation;

      if (error) {
        console.error("Error submitting order:", error);
        toast({
          title: "Error",
          description:
            "There was a problem submitting your order. Please try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // For backwards compatibility, still save in localStorage
      localStorage.setItem(
        "neurotech-order",
        JSON.stringify({
          name,
          items: orderItems,
          timestamp: new Date().toISOString(),
        })
      );

      toast({
        title: alreadyOrdered ? "Order Updated" : "Order Submitted",
        description: alreadyOrdered
          ? "Your order has been successfully updated!"
          : "Your order has been successfully submitted!",
      });

      navigate("/thank-you");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description:
          "There was a problem submitting your order. Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Food Order System
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="text-shadow">Neurotech.Africa</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Select your meal preferences from our Tanzania menu
          </p>

          {alreadyOrdered && (
            <div className="mt-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 rounded-md inline-flex items-center gap-2">
              <p>
                You've already placed an order today. You can modify and
                resubmit it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 bg-amber-100 dark:bg-amber-900 border-amber-200 dark:border-amber-800"
                onClick={handleResetOrder}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Reset
              </Button>
            </div>
          )}
        </div>

        {/* Order of the Day Section */}
        <div className="mb-4">
          <Card className="border border-border overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
              <div className="flex items-center gap-2 text-primary mb-1">
                <CalendarDays className="h-5 w-5" />
                <CardTitle className="text-xl">Order of the Day</CardTitle>
              </div>
              <CardDescription>Today's special recommendation</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-lg">{orderOfTheDay}</p>
                    <p className="text-muted-foreground text-sm">
                      Special for {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddOrderOfTheDay}
                  variant="outline"
                  className="bg-primary/5 hover:bg-primary/10"
                >
                  Add to Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {checkingOrder ? (
          <div className="text-center p-8">
            <div className="animate-spin mx-auto h-8 w-8 border-4 border-border border-t-transparent rounded-full mb-4"></div>
            <p>Loading your order information...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white border border-border rounded-xl p-5">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Your Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full"
                required
                disabled={alreadyOrdered}
              />
            </div>

            <div className="space-y-8 mb-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                  Main Dishes
                </h2>
                <p className="text-sm text-muted-foreground mb-4">Select one main dish</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {mainDishes.map((dish, index) => (
                    <MenuCard
                      key={dish}
                      title={dish}
                      selected={selectedMain === dish}
                      onSelect={() => handleMainDishClick(dish)}
                      index={index}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                  Sides / Stews (Mboga)
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedMain === "Pilau"
                    ? "Pilau is served alone without sides (4,000/=)"
                    : selectedMain === "Chips" 
                    ? "Chips can only be combined with Mayai, Kidari, or Paja" 
                    : "Select one side dish"}
                </p>
                {availableSides.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableSides.map((side, index) => (
                      <MenuCard
                        key={side}
                        title={side}
                        selected={selectedSide === side}
                        onSelect={() => handleSideClick(side)}
                        index={index + mainDishes.length}
                      />
                    ))}
                  </div>
                ) : selectedMain === "Pilau" ? (
                  <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">Pilau is a complete meal on its own</p>
                  </div>
                ) : null}
              </div>

              {(selectedMain || selectedSide) && (
                <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-lg font-semibold">Your Order</h3>
                      </div>
                    </div>
                    
                    {selectedMain && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Main: {selectedMain}</span>
                        <span className="text-sm font-medium">✓</span>
                      </div>
                    )}
                    
                    {selectedSide && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Side: {selectedSide}</span>
                        <span className="text-sm font-medium">✓</span>
                      </div>
                    )}
                    
                    {selectedMain && (selectedMain === "Pilau" || selectedSide) && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {selectedMain === "Pilau" ? "Standalone Dish" : "Combination"}
                            </p>
                            <p className="font-medium">
                              {selectedMain === "Pilau" ? "Pilau" : `${selectedMain} + ${selectedSide}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-primary">{totalCost.toLocaleString()}/=</p>
                            <p className="text-xs text-muted-foreground">TZS</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center mt-8">
              <Button
                type="submit"
                disabled={submitting}
                className="px-8 py-6 text-lg rounded-xl transition-all duration-300 hover:scale-105"
              >
                {submitting ? "Submitting..." : alreadyOrdered ? "Update Order" : "Submit Order"}
              </Button>
            </div>
          </form>
        )}

        <OrderSummary
          selectedItems={selectedItems}
          onRemove={handleRemoveItem}
        />
      </div>
    </Layout>
  );
};

export default Index;
