import { DataSource, DataSourceRow } from "@finos/vuu-data";
import { VuuRange } from "@finos/vuu-protocol-types";
import { useCallback, useEffect, useState } from "react";

export const useDataSource = ({
  dataSource,
  range,
}: {
  dataSource: DataSource;
  range: VuuRange;
}) => {
  const [data, setData] = useState<DataSourceRow[]>([]);
  useEffect(() => {
    dataSource?.subscribe({ range }, (message) => {
      if (message.type === "viewport-update") {
        // if (message.size) {
        //   console.log(`useDataSourcesize = ${message.size}`);
        // }
        if (message.rows) {
          setData(message.rows);
        }
      }
    });
  }, [dataSource]);

  const setRange = useCallback(
    (range: VuuRange) => {
      dataSource.range = range;
    },
    [dataSource]
  );

  return {
    data,
    setRange,
  };
};
