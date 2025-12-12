import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreamSourceComponent } from './stream-source.component';

describe('StreamSourceComponent', () => {
  let component: StreamSourceComponent;
  let fixture: ComponentFixture<StreamSourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreamSourceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StreamSourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
