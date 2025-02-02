import React, { useRef, useState } from "react";
import { useIntl } from "react-intl";
import cloneDeep from "lodash-es/cloneDeep";
import { useHistory } from "react-router-dom";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import {
  makeItemList,
  PersistanceLevel,
  showWhenSelected,
} from "../List/ItemList";
import { ListFilterModel } from "src/models/list-filter/filter";
import { DisplayMode } from "src/models/list-filter/types";
import { queryFindGalleries, useFindGalleries } from "src/core/StashService";
import { GalleryCard } from "./GalleryCard";
import GalleryWallCard from "./GalleryWallCard";
import { EditGalleriesDialog } from "./EditGalleriesDialog";
import { DeleteGalleriesDialog } from "./DeleteGalleriesDialog";
import { ExportDialog } from "../Shared/ExportDialog";
import { GalleryListTable } from "./GalleryListTable";
import { useContainerDimensions } from "../Shared/GridCard/GridCard";

const GalleryItemList = makeItemList({
  filterMode: GQL.FilterMode.Galleries,
  useResult: useFindGalleries,
  getItems(result: GQL.FindGalleriesQueryResult) {
    return result?.data?.findGalleries?.galleries ?? [];
  },
  getCount(result: GQL.FindGalleriesQueryResult) {
    return result?.data?.findGalleries?.count ?? 0;
  },
});

interface IGalleryList {
  filterHook?: (filter: ListFilterModel) => ListFilterModel;
  persistState?: PersistanceLevel;
  alterQuery?: boolean;
}

export const GalleryList: React.FC<IGalleryList> = ({
  filterHook,
  persistState,
  alterQuery,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportAll, setIsExportAll] = useState(false);

  const otherOperations = [
    {
      text: intl.formatMessage({ id: "actions.view_random" }),
      onClick: viewRandom,
    },
    {
      text: intl.formatMessage({ id: "actions.export" }),
      onClick: onExport,
      isDisplayed: showWhenSelected,
    },
    {
      text: intl.formatMessage({ id: "actions.export_all" }),
      onClick: onExportAll,
    },
  ];

  function addKeybinds(
    result: GQL.FindGalleriesQueryResult,
    filter: ListFilterModel
  ) {
    Mousetrap.bind("p r", () => {
      viewRandom(result, filter);
    });

    return () => {
      Mousetrap.unbind("p r");
    };
  }

  async function viewRandom(
    result: GQL.FindGalleriesQueryResult,
    filter: ListFilterModel
  ) {
    // query for a random image
    if (result.data?.findGalleries) {
      const { count } = result.data.findGalleries;

      const index = Math.floor(Math.random() * count);
      const filterCopy = cloneDeep(filter);
      filterCopy.itemsPerPage = 1;
      filterCopy.currentPage = index + 1;
      const singleResult = await queryFindGalleries(filterCopy);
      if (singleResult.data.findGalleries.galleries.length === 1) {
        const { id } = singleResult.data.findGalleries.galleries[0];
        // navigate to the image player page
        history.push(`/galleries/${id}`);
      }
    }
  }

  async function onExport() {
    setIsExportAll(false);
    setIsExportDialogOpen(true);
  }

  async function onExportAll() {
    setIsExportAll(true);
    setIsExportDialogOpen(true);
  }

  const componentRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerDimensions(componentRef);

  function renderContent(
    result: GQL.FindGalleriesQueryResult,
    filter: ListFilterModel,
    selectedIds: Set<string>,
    onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void
  ) {
    function maybeRenderGalleryExportDialog() {
      if (isExportDialogOpen) {
        return (
          <ExportDialog
            exportInput={{
              galleries: {
                ids: Array.from(selectedIds.values()),
                all: isExportAll,
              },
            }}
            onClose={() => setIsExportDialogOpen(false)}
          />
        );
      }
    }

    function renderGalleries() {
      if (!result.data?.findGalleries) return;

      if (filter.displayMode === DisplayMode.Grid) {
        return (
          <div className="row justify-content-center" ref={componentRef}>
            {result.data.findGalleries.galleries.map((gallery) => (
              <GalleryCard
                key={gallery.id}
                containerWidth={width}
                gallery={gallery}
                zoomIndex={filter.zoomIndex}
                selecting={selectedIds.size > 0}
                selected={selectedIds.has(gallery.id)}
                onSelectedChanged={(selected: boolean, shiftKey: boolean) =>
                  onSelectChange(gallery.id, selected, shiftKey)
                }
              />
            ))}
          </div>
        );
      }
      if (filter.displayMode === DisplayMode.List) {
        return (
          <GalleryListTable
            galleries={result.data.findGalleries.galleries}
            selectedIds={selectedIds}
            onSelectChange={onSelectChange}
          />
        );
      }
      if (filter.displayMode === DisplayMode.Wall) {
        return (
          <div className="row">
            <div className="GalleryWall">
              {result.data.findGalleries.galleries.map((gallery) => (
                <GalleryWallCard key={gallery.id} gallery={gallery} />
              ))}
            </div>
          </div>
        );
      }
    }

    return (
      <>
        {maybeRenderGalleryExportDialog()}
        {renderGalleries()}
      </>
    );
  }

  function renderEditDialog(
    selectedImages: GQL.SlimGalleryDataFragment[],
    onClose: (applied: boolean) => void
  ) {
    return <EditGalleriesDialog selected={selectedImages} onClose={onClose} />;
  }

  function renderDeleteDialog(
    selectedImages: GQL.SlimGalleryDataFragment[],
    onClose: (confirmed: boolean) => void
  ) {
    return (
      <DeleteGalleriesDialog selected={selectedImages} onClose={onClose} />
    );
  }

  return (
    <GalleryItemList
      zoomable
      selectable
      filterHook={filterHook}
      persistState={persistState}
      alterQuery={alterQuery}
      otherOperations={otherOperations}
      addKeybinds={addKeybinds}
      renderContent={renderContent}
      renderEditDialog={renderEditDialog}
      renderDeleteDialog={renderDeleteDialog}
    />
  );
};
