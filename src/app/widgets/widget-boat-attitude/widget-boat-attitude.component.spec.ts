import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetBoatAttitudeComponent } from './widget-boat-attitude.component';

describe('WidgetBoatAttitudeComponent', () => {
  let component: WidgetBoatAttitudeComponent;
  let fixture: ComponentFixture<WidgetBoatAttitudeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetBoatAttitudeComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetBoatAttitudeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
