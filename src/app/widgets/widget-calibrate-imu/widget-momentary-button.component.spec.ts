import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetMomentaryButtonComponent } from './widget-momentary-button.component';

describe('WidgetMomentaryButtonComponent', () => {
  let component: WidgetMomentaryButtonComponent;
  let fixture: ComponentFixture<WidgetMomentaryButtonComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetMomentaryButtonComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetMomentaryButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
