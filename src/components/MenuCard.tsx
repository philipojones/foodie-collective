
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuCardProps {
  title: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

const MenuCard: React.FC<MenuCardProps> = ({ title, selected, onSelect, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="menu-item-enter-active"
      style={{ '--delay': `${index * 100}ms` } as React.CSSProperties}
    >
      <div 
        onClick={onSelect}
        className={cn(
          "relative p-6 rounded-xl neo-shadow transition-all duration-300 cursor-pointer  border border-border",
          "hover:translate-y-[-2px]",
          selected ? "ring-2 ring-primary bg-accent" : "bg-card"
        )}
      >
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-base font-medium break-words min-w-0">{title}</h3>
          <motion.div
            initial={false}
            animate={selected ? { scale: 1.2 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {selected ? (
              <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
            ) : (
              <PlusCircle className="h-6 w-6 shrink-0 text-muted-foreground" />
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuCard;
