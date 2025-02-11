export type E2ESelectors = {
  pages: Pages;
  components: Components;
  apis: APIs;
};

export type APIs = {
  DataSource: {
    resourcePattern: string;
    resourceUIDPattern: string;
    queryPattern: string;
    query: string;
    health: (uid: string, id: string) => string;
    datasourceByUID: (uid: string) => string;
  };
  Dashboard: {
    delete: (uid: string) => string;
  };
};

export type Components = {
  TimePicker: {
    openButton: string;
    fromField: string;
    toField: string;
    applyTimeRange: string;
    absoluteTimeRangeTitle: string;
  };
  Panels: {
    Panel: {
      title: (title: string) => string;
      headerCornerInfo: (mode: string) => string;
      status: (status: string) => string;
    };
    Visualization: {
      Table: {
        header: string;
        footer: string;
        body: string;
      };
    };
  };
  PanelEditor: {
    General: {
      content: string;
    };
    applyButton: string;
    toggleVizPicker: string;
  };
  RefreshPicker: {
    runButtonV2: string;
  };
  QueryEditorRows: {
    rows: string;
  };
  QueryEditorRow: {
    title: (refId: string) => string;
  };
  Alert: {
    alertV2: (severity: string) => string;
  };
  PageToolbar: {
    item: (tooltip: string) => string;
    shotMoreItems: string;
    itemButton: (title: string) => string;
    itemButtonTitle: string;
  };
  OptionsGroup: {
    group: (title?: string) => string;
    toggle: (title?: string) => string;
    groupTitle: string;
  };
  PluginVisualization: {
    item: (title: string) => string;
  };
  Select: {
    option: string;
    input: () => string;
    singleValue: () => string;
  };
  DataSourcePicker: {
    container: string;
  };
  TimeZonePicker: {
    containerV2: string;
  };
  CodeEditor: {
    container: string;
  };
  Variables: {
    variableOption: string;
  };
  Annotations: {
    annotationsTypeInput: string;
    annotationsChoosePanelInput: string;
  };
  Tooltip: {
    container: string;
  };
};

export type Pages = {
  Home: {
    url: string;
  };
  DataSource: {
    name: string;
    delete: string;
    readOnly: string;
    saveAndTest: string;
    alert: string;
  };
  EditDataSource: {
    url: (dataSourceUid: string) => string;
  };
  AddDashboard: {
    url: string;
    itemButton: (title: string) => string;
    addNewPanel: string;
    itemButtonAddViz: string;
    Settings: {
      Annotations: {
        List: {
          url: string;
        };
        Edit: {
          url: (annotationIndex: string) => string;
        };
      };
      Variables: {
        List: {
          url: string;
        };
        Edit: {
          url: (variableIndex: string) => string;
        };
      };
    };
  };
  Dashboard: {
    url: (uid: string) => string;
    Settings: {
      Annotations: {
        Edit: {
          url: (dashboardUid: string, annotationIndex: string) => string;
        };
        List: {
          url: (uid: string) => string;
          /**
           * @deprecated use addAnnotationCTAV2 from Grafana 8.3 instead
           */
          addAnnotationCTA: string;
          addAnnotationCTAV2: string;
        };
      };
      Variables: {
        List: {
          url: (dashboardUid: string) => string;
          newButton: string;
          addVariableCTAV2: (variableName: string) => string;
          addVariableCTAV2Item: string;
        };
        Edit: {
          url: (dashboardUid: string, editIndex: string) => string;
          General: {
            generalTypeSelectV2: string;
            previewOfValuesOption: string;
            submitButton: string;
          };
        };
      };
    };
  };
  Explore: {
    url: string;
  };
};
