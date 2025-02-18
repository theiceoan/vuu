import { TabstripProps } from "@heswell/salt-lab";
import { HTMLAttributes, MouseEvent, ReactElement, ReactNode } from "react";

export interface StackProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onMouseDown"> {
  active?: number;
  createNewChild?: (index: number) => ReactElement;
  enableAddTab?: boolean;
  enableCloseTabs?: boolean;
  getTabIcon?: (component: ReactElement, index: number) => string | undefined;
  getTabLabel?: (component: ReactElement, index: number) => string | undefined;
  keyBoardActivation?: "automatic" | "manual";
  onMouseDown?: (e: MouseEvent, tabIndex: number) => void;
  onTabAdd?: (tabIndex: number) => void;
  onTabClose?: (tabIndex: number) => void;
  onTabEdit?: (tabIndex: number, label: string) => void;
  onTabSelectionChanged?: (nextIndex: number) => void;
  path?: string;
  showTabs?: boolean;
  toolbarContent?: ReactNode;
  TabstripProps?: Partial<TabstripProps>;
}
