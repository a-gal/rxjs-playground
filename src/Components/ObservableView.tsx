import { observer } from "mobx-react";
import { Point, point, Rectangle } from "../std/Point";
import { SvgText, SvgLine, SvgCircle, SvgRect } from "../std/SvgElements";
import { PositionTransformation } from "../std/DragBehavior";
import {
	SvgContext,
	TimeOffsetConversion,
	handleMouseDownOnTimedObj,
} from "./utils";
import React = require("react");
import { PlaygroundViewModel } from "../ViewModels/PlaygroundViewModel";
import {
	ObservableViewModel,
	ChildObservableViewModel,
} from "../ViewModels/ObservableViewModel";
import { Menu, MenuItem, ContextMenu } from "@blueprintjs/core";
import classNames = require("classnames");
import { observable } from "mobx";
import {
	MutableObservableHistory,
	MutableObservableEvent,
} from "../Model/MutableObservableGroup";
import { ObservableEvent } from "../Model/ObservableGroups";
import { formatValue } from "./formatValue";

@observer
export class ObservableView extends React.Component<{
	observable: ObservableViewModel;
	timeOffsetConversion: TimeOffsetConversion;
	x: number;
	height: number;
	playground: PlaygroundViewModel;
	svgContext: SvgContext;
}> {
	@observable private selectedEventId: number = -1;

	@observable temporaryEventT: number | undefined = undefined;
	@observable contextMenuT: number | undefined = undefined;
	@observable endSelected = false;

	render() {
		const playground = this.props.playground;
		const o = this.props.observable.observable;
		const m = this.props.observable;
		const timeOffsetConversion = this.props.timeOffsetConversion;
		const x = this.props.x;

		const start = point({
			x,
			y: timeOffsetConversion.getOffset(o.startTime),
		});
		const end = point({
			x,
			y: o.endTime
				? timeOffsetConversion.getOffset(o.endTime)
				: this.props.height + 100,
		});

		return (
			<g className="component-ObservableView">
				<SvgLine
					className="part-start"
					start={start.add({ x: -5 })}
					end={start.add({ x: 5 })}
				/>
				<SvgLine className="part-lifetime" start={start} end={end} />
				<SvgRect
					className="part-context-menu-space"
					rectangle={Rectangle.ofSize(
						start.sub({ x: 10 }),
						new Point(20, this.props.height)
					)}
					onMouseMove={e => {
						const p = this.props.svgContext.mouseToSvgCoordinates(
							new Point(e.clientX, e.clientY)
						);

						if (o instanceof MutableObservableHistory) {
							this.temporaryEventT = timeOffsetConversion.getTime(
								p.y
							);
						}
					}}
					onMouseLeave={() => {
						this.temporaryEventT = undefined;
					}}
					onClick={e => {
						const t = this.temporaryEventT;
						if (
							o instanceof MutableObservableHistory &&
							t !== undefined
						) {
							e.preventDefault();
							o.addEvent(t, o.events.length + 1);
						}
					}}
					onContextMenu={e => {
						const t = this.temporaryEventT;
						if (
							o instanceof MutableObservableHistory &&
							t !== undefined
						) {
							e.preventDefault();
							this.showContextMenu(o, t, e);
						}
					}}
				/>
				{(this.temporaryEventT || this.contextMenuT) && (
					<SvgCircle
						className="part-event-temporary"
						center={point({
							x,
							y: timeOffsetConversion.getOffset(
								this.temporaryEventT || this.contextMenuT!
							),
						})}
						radius={4}
					/>
				)}

				{this.renderEnd({ center: end })}

				{m.events.map((evt, idx) => {
					return this.renderEvent(evt, playground, idx);
				})}
			</g>
		);
	}

	private showContextMenu(
		o: MutableObservableHistory<any>,
		t: number,
		e: React.MouseEvent<SVGRectElement, MouseEvent>
	) {
		this.contextMenuT = t;
		ContextMenu.show(
			<Menu>
				<MenuItem
					text="Set End"
					icon="flow-end"
					onClick={() => (o.endTime = t)}
				/>
				<MenuItem
					text="Add"
					icon="add"
					onClick={() => o.addEvent(t, o.events.length + 1)}
				/>
				<MenuItem
					text="Set Recording Marker"
					icon="map-marker"
					onClick={() =>
						(this.props.playground.recordingModel.startTime = t)
					}
				/>
			</Menu>,
			{ left: e.clientX, top: e.clientY },
			() => {
				this.contextMenuT = undefined;
				this.selectedEventId = -1;
			}
		);
	}

	private renderEvent(
		evt: ObservableEvent,
		playground: PlaygroundViewModel,
		idx: number
	): JSX.Element {
		const center = point({
			x: this.props.x,
			y: this.props.timeOffsetConversion.getOffset(evt.time),
		});
		const o = this.props.observable.observable;

		const isLarge =
			playground.timedObjDragBehavior.isDataEqualTo(evt.id) ||
			this.selectedEventId === evt.id;

		if (evt.data instanceof ChildObservableViewModel) {
			return (
				<g key={evt.id} className="part-sub-observable">
					<SvgLine
						className="part-connection-line"
						start={center}
						end={center.add({ x: evt.data.xOffset })}
					/>
					<ObservableView
						height={this.props.height}
						observable={evt.data}
						playground={this.props.playground}
						svgContext={this.props.svgContext}
						timeOffsetConversion={this.props.timeOffsetConversion}
						x={this.props.x + evt.data.xOffset}
					/>
				</g>
			);
		}

		return (
			<g key={evt.id} className="part-event">
				<SvgCircle
					className={classNames(
						o instanceof MutableObservableHistory && "mutable",
						isLarge && "large"
					)}
					onContextMenu={e => {
						if (o instanceof MutableObservableHistory) {
							e.preventDefault();
							this.selectedEventId = evt.id;
							this.showEventContextMenu(o, evt, e);
						}
					}}
					center={center}
					radius={4}
					stroke="black"
					onMouseDown={e => {
						if (evt instanceof MutableObservableEvent) {
							handleMouseDownOnTimedObj(
								e,
								evt.id,
								t => (evt.time = t),
								this.props.playground,
								this.props.svgContext,
								this.props.timeOffsetConversion
							);
						}
					}}
				/>
				<SvgText
					childRef={text => {
						if (!text) {
							//this.widths.delete(idx);
						} else {
							this.props.observable.textWidths.set(
								idx,
								text.getBBox().width
							);
						}
					}}
					position={center.add(new Point(10, 0))}
					textAnchor="start"
					dominantBaseline="middle"
				>
					{formatValue(evt.data, 100)}
				</SvgText>
			</g>
		);
	}

	private showEventContextMenu(
		o: MutableObservableHistory<any>,
		evt: ObservableEvent,
		e: React.MouseEvent<SVGCircleElement, MouseEvent>
	) {
		ContextMenu.show(
			<Menu>
				<MenuItem
					text="Delete"
					icon="delete"
					onClick={() => o.removeEvent(evt)}
				/>
			</Menu>,
			{ left: e.clientX, top: e.clientY },
			() => {
				this.selectedEventId = -1;
			}
		);
	}

	private renderEnd({ center }: { center: Point }) {
		const o = this.props.observable.observable;

		return (
			<g
				className={classNames(
					"part-end",
					o instanceof MutableObservableHistory && "mutable",
					this.endSelected && "selected"
				)}
				onMouseDown={e => {
					if (o instanceof MutableObservableHistory) {
						this.endSelected = true;
						handleMouseDownOnTimedObj(
							e,
							-1,
							t => (o.endTime = t),
							this.props.playground,
							this.props.svgContext,
							this.props.timeOffsetConversion,
							() => (this.endSelected = false)
						);
					}
				}}
				onContextMenu={e => {
					if (o instanceof MutableObservableHistory) {
						e.preventDefault();
						this.endSelected = true;
						ContextMenu.show(
							<Menu>
								<MenuItem
									text="Remove End"
									icon="delete"
									onClick={() => (o.endTime = undefined)}
								/>
							</Menu>,
							{ left: e.clientX, top: e.clientY },
							() => {
								this.endSelected = false;
							}
						);
					}
				}}
			>
				<SvgCircle
					className="part-dragHandle"
					center={center}
					radius={5}
				/>
				<SvgLine
					start={center.add({ x: -5, y: -5 })}
					end={center.add({ x: 5, y: 5 })}
					stroke="black"
				/>
				<SvgLine
					start={center.add({ x: -5, y: 5 })}
					end={center.add({ x: 5, y: -5 })}
					stroke="black"
				/>
			</g>
		);
	}
}
