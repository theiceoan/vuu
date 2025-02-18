import { MenuRpcResponse, useVuuTables } from "@finos/vuu-data";
import { registerComponent } from "@finos/vuu-layout";
import { Dialog } from "@finos/vuu-popups";
import {
  Feature,
  Shell,
  ShellContextProvider,
  VuuUser,
} from "@finos/vuu-shell";
import { ReactElement, useCallback, useState } from "react";
import { AppSidePanel } from "./app-sidepanel";
import { Stack } from "./AppStack";
import { getDefaultColumnConfig } from "./columnMetaData";

import "./App.css";
// Because we do not render the AppSidePanel directly, the css will not be included in bundle.
import "./app-sidepanel/AppSidePanel.css";

const defaultWebsocketUrl = `wss://${location.hostname}:8090/websocket`;
const { websocketUrl: serverUrl = defaultWebsocketUrl, features } =
  await vuuConfig;

//TODO how do we separate this from the feature
const vuuBlotterUrl = "./feature-vuu-blotter/index.js";
// const vuuBlotterUrl = "./feature-vuu-table/index.js";

registerComponent("Stack", Stack, "container");

const defaultLayout = {
  type: "Stack",
  props: {
    style: {
      width: "100%",
      height: "100%",
    },
    showTabs: true,
    enableAddTab: true,
    enableRemoveTab: true,
    preserve: true,
    active: 0,
  },
  children: [
    {
      type: "Placeholder",
      title: "Page 1",
    },
  ],
};

export const App = ({ user }: { user: VuuUser }) => {
  const [dialogContent, setDialogContent] = useState<ReactElement>();

  const tables = useVuuTables();

  const handleRpcResponse = useCallback(
    (response?: MenuRpcResponse) => {
      if (response?.action?.type === "OPEN_DIALOG_ACTION") {
        const { table } = response.action;
        if (tables) {
          const schema = tables.get(table.table);
          if (schema) {
            // If we already have this table open in this viewport, ignore
            setDialogContent(
              <Feature
                height={400}
                params={{ schema }}
                url={vuuBlotterUrl}
                width={700}
              />
            );
          }
        }
      } else {
        console.warn(`App, handleServiceRequest ${JSON.stringify(response)}`);
      }
    },
    [tables]
  );

  const handleClose = () => setDialogContent(undefined);

  // TODO get Context from Shell
  return (
    <ShellContextProvider value={{ getDefaultColumnConfig, handleRpcResponse }}>
      <Shell
        className="App"
        defaultLayout={defaultLayout}
        leftSidePanel={<AppSidePanel features={features} tables={tables} />}
        serverUrl={serverUrl}
        user={user}
      >
        <Dialog
          className="vuDialog"
          isOpen={dialogContent !== undefined}
          onClose={handleClose}
          style={{ height: 500 }}
        >
          {dialogContent}
        </Dialog>
      </Shell>
    </ShellContextProvider>
  );
};
