import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarWorkspacesMenu } from "./sidebar-workspaces-menu";
import { SidebarCommunities } from "./sidebar-communities";
import { SidebarPrimaryMenu } from "./sidebar-primary-menu";
import { SidebarResourcesMenu } from "./sidebar-resources-menu";
import { SidebarSearch } from "./sidebar-search";
import { SidebarHeader } from "./sidebar-header";
import SidebarContent from "../SidebarContent";

export function SidebarSecondary() {
  return (
    <div className="lg:rounded-s-xl bg-background overflow-hidden border border-border flex flex-col w-full">
      <SidebarHeader />
      <ScrollArea className="shrink-0 flex-1 mt-0 mb-2.5">        
        <div className="px-2.5">
          {/* Dynamic content based on route */}
          <SidebarContent />
        </div>
      </ScrollArea>
    </div>
  );
}
