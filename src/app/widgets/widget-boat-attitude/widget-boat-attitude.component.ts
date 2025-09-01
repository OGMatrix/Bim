import { Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { DataService } from '../../core/services/data.service';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component.js';
import { IWidgetSvcConfig, IWidget } from '../../core/interfaces/widgets-interface';

@Component({
    selector: 'widget-boat-attitude',
    templateUrl: './widget-boat-attitude.component.html',
    styleUrls: ['./widget-boat-attitude.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent]
})
export class WidgetBoatAttitudeComponent extends BaseWidgetComponent implements OnDestroy {
    // Scale factors for visual rotation (adjust these to make the movement more/less dramatic)
    readonly ROLL_SCALE_FACTOR = 1.0;  // Multiplier for roll angle
    readonly PITCH_SCALE_FACTOR = 1.0; // Multiplier for pitch angle

    // Current attitude values
    currentRoll = 0;
    currentPitch = 0;

    protected startWidget(): void {
        // Observe roll values
        this.observeDataStream('roll', newValue => {
            console.log('Roll data update:', newValue);
            if (newValue?.data?.value !== undefined) {
                this.currentRoll = newValue.data.value;
            }
        });

        // Observe pitch values
        this.observeDataStream('pitch', newValue => {
            if (newValue?.data?.value !== undefined) {
                this.currentPitch = newValue.data.value;
            }
        });
    }

    protected updateConfig(config: IWidgetSvcConfig): void {
        this.widgetProperties.config = config;
        this.startWidget();
    }

    constructor() {
        super();

        // Default config
        this.defaultConfig = {
            displayName: 'Boat Attitude',
            filterSelfPaths: true,
            paths: {
                roll: {
                    description: "Roll angle path",
                    path: 'signalk-node-red.navigation.attitude.roll',
                    source: 'self',
                    pathType: "number",
                    isPathConfigurable: true,
                    convertUnitTo: 'deg',
                    sampleTime: 50,
                },
                pitch: {
                    description: "Pitch angle path",
                    path: 'signalk-node-red.navigation.attitude.pitch',
                    source: 'self',
                    pathType: "number",
                    isPathConfigurable: true,
                    convertUnitTo: 'deg',
                    sampleTime: 50,
                }
            },
            numInt: 1,
            numDecimal: 1,
            color: 'contrast',
            displayScale: {
                lower: -90,
                upper: 90,
                type: 'linear'
            },
            enableTimeout: false,
            dataTimeout: 5,
            ignoreZones: true
        };

        // Initialize widget properties with default config
        this.widgetProperties = {
            uuid: 'boat-attitude-' + Math.random().toString(36).substring(2, 9),
            config: this.defaultConfig,
            type: 'widget-boat-attitude'
        } as IWidget;

        // Validate the config
        this.validateConfig();
    }

    // Calculate transform string for SVG
    // Enhanced getSvgTransform method for widget-boat-attitude.component.ts
    getSvgTransform(): string {
        const roll = this.currentRoll || 0;
        const pitch = this.currentPitch || 0;

        // Enhanced scaling factors for more realistic movement
        const rollAngle = roll * this.ROLL_SCALE_FACTOR;
        const pitchAngle = pitch * this.PITCH_SCALE_FACTOR;

        // Center point of the boat (adjust based on your SVG dimensions)
        const centerX = 225;
        const centerY = 245;

        // Calculate realistic pitch effects
        // Positive pitch (bow up) should make the boat appear to rise at the bow
        // Negative pitch (bow down) should make the boat appear to dive at the bow
        const pitchScale = Math.cos(pitchAngle * Math.PI / 180);
        const pitchTranslateY = Math.sin(pitchAngle * Math.PI / 180) * 30;

        // Add subtle perspective effect for pitch
        const perspectiveScale = 1 + (Math.abs(pitchAngle) * 0.005); // Slight scale change based on pitch

        // Calculate roll effects with realistic physics
        // When rolling, the boat also slightly "sinks" into the water on the lower side
        const rollSinkEffect = Math.abs(rollAngle) * 0.3; // Slight vertical displacement when rolling

        // Combine all transformations in the correct order
        // Order matters: translate to center, apply transformations, translate back
        const transforms = [
            `translate(${centerX}, ${centerY})`, // Move to rotation center
            `rotate(${rollAngle * 4})`, // Apply roll rotation
            `scale(${perspectiveScale}, ${pitchScale})`, // Apply pitch scaling and perspective
            `translate(0, ${pitchTranslateY + rollSinkEffect})`, // Apply pitch translation and roll sink
            `translate(${-centerX}, ${-centerY})` // Move back from rotation center
        ].join(' ');

        return transforms;
    }

    // Additional method to get dynamic styling based on attitude
    getBoatDynamicStyle(): { [key: string]: string } {
        const roll = Math.abs(this.currentRoll || 0);
        const pitch = Math.abs(this.currentPitch || 0);

        // Calculate danger level based on attitude angles
        const totalAngle = Math.sqrt(roll * roll + pitch * pitch);
        const dangerLevel = Math.min(totalAngle / 30, 1); // Normalize to 0-1, 30° = full danger

        // Dynamic glow effect based on boat attitude
        const glowIntensity = 3 + (dangerLevel * 7); // 3-10px glow
        const glowColor = this.interpolateColor(
            { r: 100, g: 200, b: 255 }, // Calm blue
            { r: 255, g: 100, b: 100 }, // Danger red
            dangerLevel
        );

        return {
            'filter': `drop-shadow(0 0 ${glowIntensity}px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.6))`,
            'transition': 'filter 0.5s ease-out'
        };
    }

    // Helper method for color interpolation
    private interpolateColor(color1: { r: number, g: number, b: number },
        color2: { r: number, g: number, b: number },
        factor: number): { r: number, g: number, b: number } {
        return {
            r: Math.round(color1.r + (color2.r - color1.r) * factor),
            g: Math.round(color1.g + (color2.g - color1.g) * factor),
            b: Math.round(color1.b + (color2.b - color1.b) * factor)
        };
    }

    // Method to get water effect transform
    getWaterTransform(): string {
        const roll = this.currentRoll || 0;
        const time = Date.now() * 0.001; // Current time in seconds for animation

        // Create gentle wave motion that responds to boat roll
        const waveOffset = Math.sin(time * 0.5) * 2 + (roll * 0.5);
        return `translateY(${waveOffset}px) rotate(${-roll * 0.3}deg)`;
    }

    ngOnInit() {
        this.validateConfig();
        this.startWidget();
    }

    ngOnDestroy() {
        this.destroyDataStreams();
    }
}
