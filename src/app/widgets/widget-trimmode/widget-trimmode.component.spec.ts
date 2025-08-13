import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetTrimmodeComponent } from './widget-trimmode.component';

describe('WidgetTrimmodeComponent', () => {
  let component: WidgetTrimmodeComponent;
  let fixture: ComponentFixture<WidgetTrimmodeComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetTrimmodeComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetTrimmodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
