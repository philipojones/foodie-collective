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
import {
  mainDishes,
  foodDishes,
  fruitsDishes,
  juiceDishes,
  validSidesMap,
  standaloneItems,
  optionalSideItems,
  getPriceForItem,
  getOrderOfTheDay,
} from "@/lib/menuConfig";

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

  const getCombinationPrice = () => {
    if (!selectedMain && !selectedSide) return 0;

    if (selectedMain && selectedSide) {
      const combination = `${selectedMain} + ${selectedSide}`;
      return getPriceForItem(combination);
    }

    if (selectedMain) return getPriceForItem(selectedMain);
    if (selectedSide) return getPriceForItem(selectedSide);

    return 0;
  };

  const totalCost = getCombinationPrice();
  const selectedItems = selectedMain && selectedSide
    ? [`${selectedMain} + ${selectedSide}`]
    : selectedMain && standaloneItems.has(selectedMain)
    ? [selectedMain]
    : [];

  const availableSides = validSidesMap[selectedMain] || [];

  useEffect(() => {
    const checkExistingOrder = async () => {
      setCheckingOrder(true);

      const storedName = localStorage.getItem("neurotech-name");
      if (storedName) {
        setName(storedName);

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
            if (data[0].items && data[0].items.length > 0) {
              const orderItem = data[0].items[0];
              if (orderItem.includes(" + ")) {
                const [main, side] = orderItem.split(" + ");
                if (mainDishes.includes(main)) {
                  setSelectedMain(main);
                  setSelectedSide(side);
                }
              } else if (mainDishes.includes(orderItem)) {
                setSelectedMain(orderItem);
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
      return;
    }

    if (selectedSide) {
      const newValidSides = validSidesMap[dish] || [];
      if (!newValidSides.includes(selectedSide)) {
        setSelectedSide("");
        if (standaloneItems.has(dish) && !optionalSideItems.has(dish)) {
          toast({
            title: `${dish} is standalone`,
            description: `${dish} is served alone (${getPriceForItem(dish).toLocaleString()}/=)`,
          });
        } else if (newValidSides.length > 0) {
          toast({
            title: "Side cleared",
            description: `${selectedSide} is not available with ${dish}`,
          });
        }
      }
    }

    setSelectedMain(dish);
  };

  const handleSideClick = (side: string) => {
    const validSides = validSidesMap[selectedMain] || [];

    if (validSides.length === 0) {
      toast({
        title: "Invalid combination",
        description: `${selectedMain} cannot be combined with sides`,
        variant: "destructive",
      });
      return;
    }

    if (!validSides.includes(side)) {
      toast({
        title: "Invalid combination",
        description: `${selectedMain} cannot be combined with ${side}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedSide(selectedSide === side ? "" : side);
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

    if (submitting) return;

    if (!name.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter your name to continue",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMain || (!standaloneItems.has(selectedMain) && !selectedSide)) {
      toast({
        title: "Incomplete order",
        description: standaloneItems.has(selectedMain)
          ? `Click submit to confirm ${selectedMain}`
          : "Please select one main dish and one side",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      localStorage.setItem("neurotech-name", name);

      const orderItems = selectedSide
        ? [`${selectedMain} + ${selectedSide}`]
        : [selectedMain];
      let operation;

      if (alreadyOrdered && existingOrderId) {
        operation = supabase
          .from("orders")
          .update({
            items: orderItems,
            timestamp: new Date().toISOString(),
          })
          .eq("id", existingOrderId);
      } else {
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

  const getSidesMessage = () => {
    if (standaloneItems.has(selectedMain) && !optionalSideItems.has(selectedMain)) {
      return `${selectedMain} is served alone (${getPriceForItem(selectedMain).toLocaleString()}/=)`;
    }
    if (optionalSideItems.has(selectedMain)) {
      return `${selectedMain} can optionally be combined with add-ons (${getPriceForItem(selectedMain).toLocaleString()}/= alone)`;
    }
    return `Select a stew for ${selectedMain}`;
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

            <div className={`space-y-8 mb-8 ${!name.trim() ? "opacity-50 pointer-events-none" : ""}`}>
              {!name.trim() && (
                <p className="text-sm text-muted-foreground text-center italic pointer-events-auto">
                  Enter your name above to start ordering
                </p>
              )}
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                    Food
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">Select one item</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {foodDishes.map((dish, index) => (
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

                <div>
                  <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                    Fruits
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {fruitsDishes.map((dish, index) => (
                      <MenuCard
                        key={dish}
                        title={dish}
                        selected={selectedMain === dish}
                        onSelect={() => handleMainDishClick(dish)}
                        index={index + foodDishes.length}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                    Juice
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                    {juiceDishes.map((dish, index) => (
                      <MenuCard
                        key={dish}
                        title={dish}
                        selected={selectedMain === dish}
                        onSelect={() => handleMainDishClick(dish)}
                        index={index + foodDishes.length + fruitsDishes.length}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {selectedMain && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                    {availableSides.length > 0 ? "Sides / Stews (Mboga)" : "Selection"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {getSidesMessage()}
                  </p>
                  {availableSides.length > 0 ? (
                    <div>
                      {optionalSideItems.has(selectedMain) && (
                        <p className="text-sm text-muted-foreground mb-2 italic">Add-ons are optional</p>
                      )}
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
                    </div>
                  ) : standaloneItems.has(selectedMain) ? (
                    <div className="text-center p-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground">{selectedMain} is a complete item on its own</p>
                    </div>
                  ) : null}
                </div>
              )}

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

                    {selectedMain && (standaloneItems.has(selectedMain) || selectedSide) && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {selectedSide ? "Combination" : "Standalone Item"}
                            </p>
                            <p className="font-medium">
                              {selectedSide ? `${selectedMain} + ${selectedSide}` : selectedMain}
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
                disabled={submitting || !name.trim() || !selectedMain || (!standaloneItems.has(selectedMain) && !selectedSide)}
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
