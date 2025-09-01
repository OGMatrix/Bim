  // Cache for latest values of each path
import { AfterViewInit, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';

type TrimMode = 'n' | 't' | 'w' | null;

@Component({
  selector: 'widget-trimmode',
  standalone: true,
  imports: [
    WidgetHostComponent,
    WidgetTitleComponent,
    MatButtonToggleModule,
    MatButtonModule,
    NgxResizeObserverModule,
  ],
  templateUrl: './widget-trimmode.component.html',
  styleUrl: './widget-trimmode.component.scss',
})
export class WidgetTrimmodeComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  // Cache for latest values of each path
  private latestPathValues: { [key: string]: number } = {};
  // Track last requestId for each mode
  private lastRequestIds: { [mode in TrimMode]?: string } = {};
  private signalkRequestsService = inject(SignalkRequestsService);
  private appService = inject(AppService);

  protected labelColor: string | undefined = undefined;
  protected accentColor: string | undefined = undefined;
  protected activeMode = signal<TrimMode>(null);
  private skRequestSub: Subscription = new Subscription();

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Trim Mode',
      filterSelfPaths: true,
      paths: {
        normalPath: {
          description: 'Trim Normal (number)',
          path: 'electrical.switches.bank.107.trimmNormal.state',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: null,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          supportsPut: true,
          sampleTime: 500,
        },
        tubePath: {
          description: 'Trim Tube (number)',
          path: 'electrical.switches.bank.107.trimmTube.state',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: null,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          supportsPut: true,
          sampleTime: 500,
        },
        wakePath: {
          description: 'Trim Wake (number)',
          path: 'electrical.switches.bank.107.trimmWake.state',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: null,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          supportsPut: true,
          sampleTime: 500,
        },
      },
      enableTimeout: false,
      dataTimeout: 5,
      color: 'contrast',
      putEnable: true,
    };

    effect(() => {
      if (this.theme()) {
        this.setColors(this.widgetProperties?.config?.color);
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  protected startWidget(): void {
    // Observe all three trim mode paths
    this.unsubscribeDataStream();
    this.observeDataStream('normalPath', (update) => {
      console.log(update);
      this.latestPathValues['normalPath'] = typeof update?.data?.value === 'number' ? update.data.value : null;
      this.updateActiveMode();
    });
    this.observeDataStream('tubePath', (update) => {
      console.log(update);
      this.latestPathValues['tubePath'] = typeof update?.data?.value === 'number' ? update.data.value : null;
      this.updateActiveMode();
    });
    this.observeDataStream('wakePath', (update) => {
      console.log(update);
      this.latestPathValues['wakePath'] = typeof update?.data?.value === 'number' ? update.data.value : null;
      this.updateActiveMode();
    });

    // Listen to PUT response messages
    this.skRequestSub?.unsubscribe();
    this.subscribeSKRequest();
  }

  private updateActiveMode(): void {
    const normal = this.latestPathValues['normalPath'];
    const tube = this.latestPathValues['tubePath'];
    const wake = this.latestPathValues['wakePath'];
    const activeCount = [normal, tube, wake].filter(v => v === 1).length;
    if (activeCount === 1) {
      if (normal === 1) this.activeMode.set('n');
      else if (tube === 1) this.activeMode.set('t');
      else if (wake === 1) this.activeMode.set('w');
    } else {
      this.activeMode.set(null);
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.setColors(this.widgetProperties.config.color);
    this.startWidget();
  }

  protected onResized(_event?: ResizeObserverEntry): void {
    // No-op for now; layout is responsive via CSS
  }

  onModeChange(event: MatButtonToggleChange): void {
    const mode = event.value as TrimMode;
    this.sendMode(mode);
  }

  selectMode(mode: TrimMode): void {
    this.sendMode(mode);
  }

  private sendMode(mode: TrimMode): void {
    if (!mode) { return; }
    const paths = this.widgetProperties.config.paths;
    const uuid = this.widgetProperties.uuid;

    // Set selected mode to 1, others to 0, and track requestIds
    let reqN: string | undefined, reqT: string | undefined, reqW: string | undefined;
    switch (mode) {
      case 'n':
        reqN = this.signalkRequestsService.putRequest(paths['normalPath'].path, 1, uuid);
        reqT = this.signalkRequestsService.putRequest(paths['tubePath'].path, 0, uuid);
        reqW = this.signalkRequestsService.putRequest(paths['wakePath'].path, 0, uuid);
        break;
      case 't':
        reqN = this.signalkRequestsService.putRequest(paths['normalPath'].path, 0, uuid);
        reqT = this.signalkRequestsService.putRequest(paths['tubePath'].path, 1, uuid);
        reqW = this.signalkRequestsService.putRequest(paths['wakePath'].path, 0, uuid);
        break;
      case 'w':
        reqN = this.signalkRequestsService.putRequest(paths['normalPath'].path, 0, uuid);
        reqT = this.signalkRequestsService.putRequest(paths['tubePath'].path, 0, uuid);
        reqW = this.signalkRequestsService.putRequest(paths['wakePath'].path, 1, uuid);
        break;
      default:
        break;
    }
    // Save the requestId for the mode that was set to 1
    if (mode === 'n' && reqN) this.lastRequestIds['n'] = reqN;
    if (mode === 't' && reqT) this.lastRequestIds['t'] = reqT;
    if (mode === 'w' && reqW) this.lastRequestIds['w'] = reqW;
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe((requestResult) => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        // Only update if this is the latest request for a mode and it was successful
        if (requestResult.statusCode === 200 && requestResult.state === 'COMPLETED') {
          let foundMode: TrimMode = null;
          if (this.lastRequestIds['n'] === requestResult.requestId) foundMode = 'n';
          if (this.lastRequestIds['t'] === requestResult.requestId) foundMode = 't';
          if (this.lastRequestIds['w'] === requestResult.requestId) foundMode = 'w';
          if (foundMode) {
            this.activeMode.set(foundMode);
          }
        } else if (requestResult.statusCode !== 200) {
          let errMsg = `Trim Mode Widget ${this.widgetProperties.config.displayName}: `;
          if (requestResult.message) {
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + ' - ' + requestResult.statusCodeDescription;
          }
          this.appService.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  private setColors(color: string): void {
    switch (color) {
      case 'contrast':
        this.labelColor = this.theme().cardColor;
        break;
      case 'blue':
        this.labelColor = this.theme().blueDim;
        break;
      case 'green':
        this.labelColor = this.theme().greenDim;
        break;
      case 'pink':
        this.labelColor = this.theme().pinkDim;
        break;
      case 'orange':
        this.labelColor = this.theme().orangeDim;
        break;
      case 'purple':
        this.labelColor = this.theme().purpleDim;
        break;
      case 'grey':
        this.labelColor = this.theme().greyDim;
        break;
      case 'yellow':
        this.labelColor = this.theme().yellowDim;
        break;
      default:
        this.labelColor = this.theme().cardColor;
        break;
    }

    // Use alarm color as the active accent (red-ish)
    this.accentColor = this.theme().zoneAlarm;
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.skRequestSub?.unsubscribe();
  }
}


