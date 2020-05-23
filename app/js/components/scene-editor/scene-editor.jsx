import React from "react";
import PropTypes from "prop-types";
import $ from "jquery";
import _ from "lodash";

import clipBoard from "../../clipboard.js";
const osClipboard = window.require("electron").clipboard;

import "cardinal-spline-js/curve.min.js";

const opentype = _.assignIn(require("opentype.js"), require("../../lib/opentype.extension.js"));

import Scene from "../../models/scene.js";

import SceneItemsList from "./scene-items-list.jsx";
import TemplateActions from "./template-actions.jsx";
import SceneActions from "./scene-actions.jsx";
import SceneSettings from "./scene-settings.jsx";
import AssetSettings from "./asset-settings.jsx";
import AssetContextMenu from "./asset-context-menu.jsx";

import Modal from "../common/modal.jsx";
import Hand from "../../hands.js";

const remote = window.require("electron").remote;
const ipcRenderer = window.require("electron").ipcRenderer;

const chalkboard = new Image();
chalkboard.src = "images/Chalkboard-background.jpg";
const chalkboard_green = new Image();
chalkboard_green.src = "images/Chalkboard-background-green.jpg";

let server_path = "/templates/";

class SceneEditor extends React.Component {
	static propTypes = {
		item: PropTypes.object,
		video: PropTypes.object,
		requiresSave: PropTypes.bool,
		canPreview: PropTypes.bool,
		videoActionListener: PropTypes.func
	};

	state = {
		initialCanvasWidth: 1152, // 60% of 1920
		initialCanvasHeight: 648,
		canvasAlign: "absolute-center",
		canvasCursor: "arrow",
		zoom: 1,
		initialZoom: 1,
		fullPreviewZoom: Math.min(1, ($(window).width() / (1920 * 0.6)) * 0.8),
		selection: [],
		selectionTop: 0,
		selectionLeft: 0,
		selectionWidth: 0,
		selectionHeight: 0,
		style: "whiteboard"
	};

	componentDidMount() {
		this.mounted = true;
		let computedZoom = Math.min(
			1,
			Math.min(
				($(".canvas-holder").width() - 40) / this.state.initialCanvasWidth,
				($(".canvas-holder").height() - 40) / this.state.initialCanvasHeight
			)
		);
		this.setState({
			zoom: computedZoom,
			initialZoom: computedZoom
		});
		this.load();
		window.addEventListener("resize", this.centerCanvas);
		document.onkeydown = this.handleKeyDown;
	}

	componentWillUnmount() {
		this.mounted = false;

		if (this.state.scene) delete this.state.scene.onChangeCallback;

		window.removeEventListener("resize", this.centerCanvas);
		document.onkeydown = null;
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.props.item != prevProps.item) {
			if (prevProps.item) delete prevProps.item.onChangeCallback;

			this.setState({
				selection: [],
				selectionLeft: null,
				selectionTop: null,
				selectionWidth: null,
				selectionHeight: null
			});
			this.load();
		} else {
			if (this.props.video && this.props.video.style != this.state.style) {
				this.setState({ style: this.props.video.style });
				if (this.state.scene && !this.state.scene.loading) this.requestCanvasUpdate();
			}
		}
	}

	handleMouseMove = e => {
		if (this.state.resizing) this.handleSelectionResize(e);
		if (this.state.rotating) this.handleSelectionRotate(e);
	};

	handleMouseDown = e => {
		var x = (e.clientX - $(".main-canvas").offset().left) / (this.state.initialCanvasWidth * this.state.zoom);
		var y = (e.clientY - $(".main-canvas").offset().top) / (this.state.initialCanvasHeight * this.state.zoom);

		this.setState({
			dragStartX: x,
			dragStartY: y,
		});
	};

	handleMouseUp = e => {
		if (this.state.resizing) {
			this.setState({ resizing: false });
			$(".handle.active").removeClass("active");
			delete this.cachedAsset;
			this.state.selection.forEach(asset =>
				asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style)
			);
			this.state.scene.updateStatus();

			this.mouseUpHandled = true;
			this.state.scene.history.push({
				action: "resize_selection",
				scope: this.state.selection,
				startingZoom: this.state.startingZoom
			});
		}

		if (this.state.rotating) {
			this.setState({ rotating: false });
			this.state.scene.updateStatus();
			this.mouseUpHandled = true;
			this.state.scene.history.push({
				action: "rotate_selection",
				scope: this.state.selection,
				startingAngle: this.state.initialAngle,
				startingItemAngles: this.state.initialSelectionAngles
			});
		}

		if (this.state.dragging) {
			this.setState({ dragging: false });
			this.state.scene.updateStatus();

			var x = (e.clientX - $(".main-canvas").offset().left) / (this.state.initialCanvasWidth * this.state.zoom);
			var y = (e.clientY - $(".main-canvas").offset().top) / (this.state.initialCanvasHeight * this.state.zoom);

			if (x - this.state.dragStartX != 0 || y - this.state.dragStartY != 0)
				this.state.scene.history.push({
					action: "move_selection",
					scope: this.state.selection,
					initialSelectionPosition: this.state.initialSelectionPosition
				});
		}
	};

	handleMouseClick = e => {
		if (this.mouseUpHandled) {
			this.mouseUpHandled = false;
			return false;
		}

		var x = e.clientX - $(".canvas-holder").offset().left;
		var y = e.clientY - $(".canvas-holder").offset().top;

		var rx = this.state.selectionLeft + this.state.selectionWidth / 2,
			ry = this.state.selectionTop + this.state.selectionHeight / 2,
			width = this.state.selectionWidth,
			height = this.state.selectionHeight,
			angle = this.state.selectionAngle;

		// deselect when clicking outside
		if (!this.pointInsideRectangle(rx, ry, width, height, angle, x, y)) this.setState({ selection: []});

		this.requestCanvasUpdate();
	};

	controlState = e =>{
		if(window.navigator.platform.indexOf("Mac")!==-1){
			return (!e.keyCode|| e.keyCode === 91) && e.metaKey;
		}
		return (!e.keyCode || e.keyCode === 17) && e.ctrlKey;
	};

	getSelectionItems = e => {
		if (this.controlState(e)) {
			if (this.state.selection.indexOf(this.state.hoverTarget) === -1) {
				return [...this.state.selection, this.state.hoverTarget];
			}
			return this.state.selection.filter(a=>a!==this.state.hoverTarget);
		}
		return [this.state.hoverTarget];
	};

	handleKeyDown = e => {
		if (e.keyCode === 27){
			this.setState({
				selection:[],
			});
		}
		if (e.keyCode == 90 && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			this.handleUndo();
		}

		// copy
		if (e.keyCode == 67 && (e.metaKey || e.ctrlKey)) {
			if (this.state.selection.length > 0) {
				let items = _.cloneDeep(this.state.selection);
				items.forEach(item => {
					delete item.cache;
					delete item.img;
					delete item.cachedImg;
					delete item.highlightImg;
					delete item.previewCache;
					delete item.eraseImg;
					delete item.previewEraseImg;
					delete item.cache;
				});
				clipBoard.put(items);
				osClipboard.clear();
			}
		}

		// paste
		if (e.keyCode == 86 && (e.metaKey || e.ctrlKey)) {
			if (clipBoard.get() && e.target.nodeName != "TEXTAREA" && e.target.nodeName != "INPUT") {
				this.state.scene.pasteAssets(clipBoard.get());
			}
		}

		let moveByAmount = 2;
		// left
		if (e.keyCode == 37) {
			this.handleMoveSelection(e.shiftKey ? -moveByAmount * 5 : -moveByAmount, 0);
		}
		// up
		if (e.keyCode == 38) {
			this.handleMoveSelection(0, e.shiftKey ? -moveByAmount * 5 : -moveByAmount);
		}
		// right
		if (e.keyCode == 39) {
			this.handleMoveSelection(e.shiftKey ? moveByAmount * 5 : moveByAmount, 0);
		}
		// down
		if (e.keyCode == 40) {
			this.handleMoveSelection(0, e.shiftKey ? moveByAmount * 5 : moveByAmount);
		}
	};

	render() {
		var styles = {
			selection: {
				left: this.state.selectionLeft,
				top: this.state.selectionTop,
				width: this.state.selectionWidth,
				height: this.state.selectionHeight,
				transform: "rotate(" + this.state.selectionAngle + "deg)",
				visibility: this.state.selection.length > 0 ? "visible" : "hidden"
			},
			controls: {
				visibility: this.state.selection.length >= 1 ? "visible" : "hidden"
			}
		};

		return (
			<div className={"scene-editor flex fill stretch" + " " + (this.props.video && this.props.video.style)}>
				<div
					className="canvas-holder flex fill"
					ref="canvasHolder"
					onMouseUp={this.handleMouseUp}
					onMouseMove={this.handleMouseMove}
					onClick={this.handleMouseClick}
					onMouseDown={this.handleMouseDown}>
					<div className="canvas-scroll fill">
						<canvas
							className={"main-canvas " + this.state.canvasAlign + " " + this.state.canvasCursor}
							ref="mainCanvas"
							width={this.state.initialCanvasWidth * this.state.zoom}
							height={this.state.initialCanvasHeight * this.state.zoom}
							onMouseDown={this.handleCanvasMouseDown}
							onMouseMove={this.handleCanvasMouseMove}
							onClick={this.handleCanvasMouseClick}
							onDoubleClick={this.handleCanvasDoubleClick}
							onDragOver={this.handleDragOver}
							onDrop={this.handleDrop}
							onContextMenu={this.handleCanvasContextMenu}
						/>
					</div>
					<i
						className={!this.state.scene || this.state.scene.loading ? "spinner fa fa-3x fa-refresh fa-spin" : "hidden"}
					/>
					<div className="canvas-controls">
						<button className="btn xs clear grid" onClick={this.toggleShowGrid}>
							<i className="fa fa-th" />&nbsp;{this.state.showGrid ? "Hide" : "Show"} grid
						</button>
					</div>
					<div className="selection" style={styles.selection}>
						<div className="handle top-left" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle top" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle top-right" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle right" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle bottom-right" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle bottom" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle bottom-left" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="handle left" onMouseDown={this.handleSelectionResizeStart}>
							<i className="fa fa-caret-left" />
							<i className="fa fa-caret-right" />
						</div>
						<div className="rotate" onMouseDown={this.handleSelectionRotationStart}>
							<div className="fa-stack">
								<i className="fa fa-repeat fa-stack-2x" />
								<i className="fa fa-circle fa-stack-1x" />
							</div>
						</div>
						<div className="selection-controls flex space-between center" style={styles.controls}>
							<div className="align-controls">
								{this.state.selection.length >= 1 &&
									this.state.selection[0].type == "font" &&
									this.state.selection[0].text.indexOf("\n") != -1 && (
										<div>
											<button className="btn clear" title="Align Left" onClick={this.alignTextLeft}>
												<i className="fa fa-lg fa-align-left" />
											</button>
											<button className="btn clear" title="Align Center" onClick={this.alignTextCenter}>
												<i className="fa fa-lg fa-align-center" />
											</button>
											<button className="btn clear" title="Align Right" onClick={this.alignTextRight}>
												<i className="fa fa-lg fa-align-right" />
											</button>
										</div>
									)}
							</div>
							<div className="flex center">
								{this.state.selection.length >= 1 && (
									<div className="flex center">
										{this.state.selection.length === 1 && 
											this.state.selection[0].type == "image" &&
											this.props.video &&
											this.state.selection[0].user_id == this.props.user.id && (
												<button
													className="btn clear"
													title="Edit"
													onClick={this.handleEditAsset}
													style={styles.editControl}>
													<img src="images/edit.svg" width="16" height="16" />
												</button>
											)}
										<button
											className="btn clear"
											title="Asset settings"
											style={{ paddingBottom: 3 }}
											onClick={this.showAssetSettings}>
											<i className="fa fa-gear" />
										</button>
										{this.state.selection.filter(s=>s.type==="image").length > 0 && (
											<button className="btn clear" title="Flip" onClick={this.handleSelectionFlip}>
												<img src="images/flip.svg" />
											</button>
										)}
										<button className="btn clear" title="Bring forward" onClick={this.handleBringForward}>
											<img src="images/bring_forward_2.png" />
										</button>
										<button className="btn clear" title="Send backwards" onClick={this.handleSendBackwards}>
											<img src="images/send_backwards_2.png" />
										</button>
									</div>
								)}
								<button className="btn clear" title="Remove" onClick={this.handleSelectionDelete}>
									<img src="images/trash.png" />
								</button>
							</div>
						</div>
					</div>
					<Modal ref="previewModal" onCancel={this.handleDismissPreview}>
						<canvas
							className="preview-canvas-full"
							ref="previewCanvasFull"
							width={this.state.initialCanvasWidth * this.state.fullPreviewZoom}
							height={this.state.initialCanvasHeight * this.state.fullPreviewZoom}
							onClick={this.pausePreview}
						/>
					</Modal>
					<Modal ref="editTextModal">
						<textarea ref="editTextBox" className="edit-text-box" />
						<div className="text-right">
							<button className="btn success" onClick={this.handleFisnishedEditingText}>
								Done
							</button>
						</div>
					</Modal>
					<div className="toast" ref="toast" />
				</div>

				<div className="right-sidebar flex column">
					{this.state.mode == "template" ? (
						<TemplateActions scene={this.state.scene} {...this.props} sceneActionListener={this.handleAction} />
					) : (
						<SceneActions scene={this.state.scene} {...this.props} sceneActionListener={this.handleAction} />
					)}

					<h3>Tools</h3>
					<div className="group tools">
						<button className="btn" onClick={this.handleZoomIn}>
							<i className="fa fa-search-plus" />
						</button>
						<button className="btn" onClick={this.handleZoomOut}>
							<i className="fa fa-search-minus" />
						</button>
					</div>
					<h3>Items</h3>
					<SceneItemsList
						items={this.state.scene ? this.state.scene.items : []}
						selection={this.state.selection}
						onSelectItem={this.handleSelectItem}
						onChange={this.updateSceneStatus}
					/>
				</div>
				{this.state.mode == "scene" && (
					<SceneSettings
						ref="sceneSettings"
						scene={this.state.scene}
						onChange={this.updateSceneStatus}
						video={this.props.video}
					/>
				)}
				{this.state.selection.length > 0 && (
					<AssetSettings
						ref="assetSettings"
						assets={this.state.selection}
						onChange={this.handleApplyAssetSettings}
					/>
				)}
				{this.props.video &&
					this.state.selection.length == 1 && (
						<AssetContextMenu ref="assetContextMenu" actionListener={this.handleAction} />
					)}
			</div>
		);
	}

	/* ----- TEMPLATE FUNCTION ----- */
	load = () => {
		if (!this.props.item) return;
		var scene;
		if (this.props.item.cache) {
			// simply open previously loaded scene
			scene = this.props.item;
			scene.onChangeCallback = this.sceneChanged;
		} else {
			// load scene from the server
			scene = new Scene(this.props.item, this.props.video && this.props.video.cache, this.sceneChanged);
		}

		this.setState({
			scene: scene,
			mode: this.props.item.type == "template" ? "template" : "scene",
			history: []
		});

		if (!scene.loading) {
			if (this.state.zoom != scene.cachedMainZoom)
				scene.updateImageCache(this.state.zoom, 0, this.props.video && this.props.video.style);
			this.requestCanvasUpdate();
		}

		if (this.props.video)
			this.setState({
				style: this.props.video.style
			});

		server_path = this.props.item.type == "template" ? "/templates/" : "/scenes";
	};

	sceneChanged = errorRequest => {
		let time = Date.now();
		if (!this.mounted) return;
		if (!errorRequest) {
			if (this.props.videoActionListener) this.props.videoActionListener("change");
			else this.forceUpdate();

			this.requestCanvasUpdate();
		} else this.props.handleAjaxFail(errorRequest, this.load);
	};

	save = () => {
		$(".toast")
			.html("Saving...")
			.fadeIn(500);

		this.state.scene.save(errorRequest => {
			if (!errorRequest) {
				$(".toast").html("Saved successfully");
				setTimeout(() => {
					$(".toast").fadeOut(500);
				}, 2000);
				this.props.item.thumb_path = this.state.scene.thumbnail;
				if (this.props.item.onStatusChange) {
					this.props.item.onStatusChange();
				}
			} else this.props.handleAjaxFail(errorRequest, this.save);
		});
	};
	publish = () => {
		$(".toast")
			.html("Publishing...")
			.fadeIn(500);
		$.ajax({
			url: server_url + "/templates/" + this.props.item.id,
			type: "PUT",
			data: { status: "published" }
		})
			.done(data => {
				this.props.item.status = "published";
				if (this.props.item.onStatusChange) {
					this.props.item.onStatusChange();
				}
				this.forceUpdate();
			})
			.fail((request, textStatus, error) => this.props.handleAjaxFail(request, this.publish))
			.always(() => {
				$(".toast").fadeOut();
			});
	};

	unpublish = () => {
		$(".toast")
			.html("Unpublishing...")
			.fadeIn(500);
		$.ajax({
			url: server_url + "/templates/" + this.props.item.id,
			type: "PUT",
			data: { status: "none" }
		})
			.done(data => {
				this.props.item.status = "none";
				if (this.props.item.onStatusChange) {
					this.props.item.onStatusChange();
				}
				this.forceUpdate();
			})
			.fail((request, textStatus, error) => this.props.handleAjaxFail(request, this.unpublish))
			.always(() => {
				$(".toast").fadeOut();
			});
	};

	delete = () => {
		confirm("Are you sure you want to delete this template? This action is not reversible.").then(() => {
			$(".toast")
				.html("Deleting template...")
				.fadeIn(500);
			$.ajax({
				url: server_url + server_path + this.props.item.id,
				type: "DELETE",
				data: { status: "inactive" }
			})
				.done(data => {
					// notify the uppser authority that the template is no more so that the scene editor is closed
					if (this.props.item.onStatusChange) {
						this.props.item.status = "deleted";
						this.props.item.onStatusChange();
					}
				})
				.fail((request, textStatus, error) => this.props.handleAjaxFail(request, this.unpublish))
				.always(() => {
					$(".toast").fadeOut();
				});
		});
	};

	finishEditing = () => {
		if (!this.state.scene.requiresSave) this.props.item.onClose();
		else
			confirm("This scene has unsaved changes that will be discarded. Are you sure you want to continue?").then(() => {
				this.props.item.onClose();
			});
	};

	handleAction = action => {
		if (typeof action == "object") {
			var data = action.data;
			var action = action.action;
		}
		if (this.state.mode == "template") {
			switch (action) {
				case "save":
					this.save();
					break;
				case "publish":
					this.publish();
					break;
				case "unpublish":
					this.unpublish();
					break;
				case "delete":
					this.delete();
					break;
				case "finish_editing":
					this.finishEditing();
					break;
				case "preview":
					this.startPreview();
					break;
				default:
			}
		} else {
			switch (action) {
				case "settings":
					this.refs.sceneSettings.show();
					break;
				case "erase_asset":
					if (this.props.video) {
						this.state.scene.eraseAsset(data.asset);
						this.props.video.duplicateScene(
							this.props.video.scenes.findIndex(scene => scene.getDataString() == this.state.scene.getDataString())
						);
					}
					break;
				default:
					if (this.props.videoActionListener) {
						// pass the action to the video editor
						this.props.videoActionListener(action);
					}
			}
		}
	};

	handleUndo = () => {
		var historyEvent = this.state.scene.history.pop();
		if (historyEvent) {
			switch (historyEvent.action) {
				case "add_item":
					this.state.scene.removeAssets(
						historyEvent.scope instanceof Array ? historyEvent.scope : [historyEvent.scope]
					);
					this.clearSelection();
					break;
				case "move_selection":
					historyEvent.scope.forEach((item, index) => {
						item.x = historyEvent.initialSelectionPosition[index].x;
						item.y = historyEvent.initialSelectionPosition[index].y;
					});
					this.setState({ selection: historyEvent.scope });
					this.state.scene.updateStatus();
					this.requestCanvasUpdate();
					break;
				case "resize_selection":
					historyEvent.scope.forEach((item, index) => {
						item.zoom = historyEvent.startingZoom[index];
					});
					this.setState({ selection: historyEvent.scope });
					this.state.scene.updateStatus();
					this.requestCanvasUpdate();
					break;
				case "rotate_selection":
					historyEvent.scope.forEach((item, index) => {
						item.angle = _.round(historyEvent.startingAngle + historyEvent.startingItemAngles[index], 2);
					});
					this.setState({ selection: historyEvent.scope });
					this.state.scene.updateStatus();
					this.requestCanvasUpdate();
					break;
				case "change_animation_delay":
					historyEvent.scope.animationDelay = historyEvent.prevValue;
					this.state.scene.updateStatus();
					this.forceUpdate();
					break;
				case "change_animation_duration":
					historyEvent.scope.animationDuration = historyEvent.prevValue;
					this.state.scene.updateStatus();
					this.forceUpdate();
					break;
				default:
					break;
			}
		}
	};

	/* ----- DRAG AND DROP ----- */
	handleDragOver = e => {
		e.preventDefault();
	};

	handleDrop = e => {
		if (!this.state.scene || this.state.scene.loading) return;

		var item = JSON.parse(e.dataTransfer.getData("item"));
		if (item.type == "sound") {
			alert("You cannot drop audio files to scenes. Please drag them to the audio timeline below.");
			return;
		}

		var x = _.round((e.clientX - $(e.target).offset().left) / (this.state.initialCanvasWidth * this.state.zoom), 3),
			y = _.round((e.clientY - $(e.target).offset().top) / (this.state.initialCanvasHeight * this.state.zoom), 3);

		this.addAsset(item, x, y);
	};

	addAsset = (item, x, y) => {
		if (this.state.scene.loading) return;

		this.state.scene.loading = 1;
		this.forceUpdate();

		var item = _.cloneDeep(item);

		this.state.scene.addAsset(
			item,
			x,
			y,
			{
				width: this.state.initialCanvasWidth,
				height: this.state.initialCanvasHeight
			},
			item => {
				if (item instanceof Array)
					item.forEach(asset =>
						asset.createImageCache(
							this.state.zoom,
							this.state.fullPreviewZoom,
							this.props.video && this.props.video.style
						)
					);
				else
					item.createImageCache(
						this.state.zoom,
						this.state.fullPreviewZoom,
						this.props.video && this.props.video.style
					);

				this.state.scene.history.push({
					action: "add_item",
					scope: item
				});
			}
		);

		if (item.type == "template") this.clearSelection();
	};

	/* ----- CANVAS ----- */
	requestCanvasUpdate() {
		if (this.updatingCanvas) {
			cancelAnimationFrame(this.updatingCanvas);
		}
		this.updatingCanvas = requestAnimationFrame(this.updateCanvas);
	}

	updateCanvas = () => {
		var canvas = this.refs.mainCanvas;
		if (!canvas) return;
		var ctx = canvas.getContext("2d");

		// clear canvas
		ctx.globalCompositeOperation = "source-over";
		switch (this.state.style) {
			case "blackboard":
				ctx.drawImage(chalkboard, 0, 0, canvas.width, canvas.height);
				break;
			case "greenboard":
				ctx.drawImage(chalkboard_green, 0, 0, canvas.width, canvas.height);
				break;
			default:
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		if (this.state.showGrid) {
			let lightColor =
				this.props.video.style == "blackboard" || this.props.video.style == "greenboard" ? "#666" : "#ccc";
			let darkColor =
				this.props.video.style == "whiteboard" || this.props.video.style == "greenboard" ? "#000" : "#999";
			ctx.save();
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = this.props.video.style == "blackboard" || this.props.video.style == "greenboard" ? 0.5 : 1;
			for (var i = 1; i < 50; i++) {
				ctx.beginPath();
				ctx.strokeStyle = i % 5 == 0 ? darkColor : lightColor;
				ctx.setLineDash([2, 2]);
				ctx.moveTo((canvas.width / 50) * i, 0);
				ctx.lineTo((canvas.width / 50) * i, canvas.height);
				ctx.moveTo(0, (canvas.width / 50) * i);
				ctx.lineTo(canvas.width, (canvas.width / 50) * i);
				ctx.stroke();
			}
			ctx.restore();
		}

		let tempCanvas = document.createElement("canvas");
		tempCanvas.width = canvas.width;
		tempCanvas.height = canvas.height;
		this.state.scene.draw(tempCanvas, this.state.zoom, this.state.hoverTarget, false, this.state.style);

		if (this.state.style == "glassboard") ctx.globalCompositeOperation = "multiply";
		if (this.state.style == "blackboard" || this.state.style == "greenboard") ctx.globalCompositeOperation = "screen";

		ctx.drawImage(tempCanvas, 0, 0);

		this.updateSelection();
		this.setCanvasCursor();
		this.centerCanvas();
	};

	handleCanvasMouseMove = e => {
		if (!this.state.scene || this.state.scene.loading) return;
		const {x,y,inRect} = this.isInSelectionRect(e);
		this.setCanvasCursor(inRect);

		if (this.state.resizing) return;
		if (this.state.dragging) {
			_.each(
				this.state.selection,
				function(asset,index) {
					asset.x = _.round(x - this.state.targetOffsetX[index], 3);
					asset.y = _.round(y - this.state.targetOffsetY[index], 3);
				}.bind(this)
			);
			this.requestCanvasUpdate();
		} else if (!this.state.resizing && !this.state.rotating) {
			var target = this.getObjectAt(x, y);
			if (this.state.hoverTarget != target) {
				this.setState({ hoverTarget: target });
				this.requestCanvasUpdate();
			}
		}
	};

	isInSelectionRect = e =>{
		var x = _.round((e.clientX - $(e.target).offset().left) / (this.state.initialCanvasWidth * this.state.zoom), 3);
		var y = _.round((e.clientY - $(e.target).offset().top) / (this.state.initialCanvasHeight * this.state.zoom), 3);
		const selectionEl = document.querySelector(".selection");
		const {left,right,top,bottom} = selectionEl.getBoundingClientRect();
		if (e.clientX >= left && e.clientX <= right && e.clientY >= top && e.clientY <= bottom){
			return {x: x,y: y,inRect: true};
		}
		return {x: x,y: y,inRect: false};
	};

	handleCanvasMouseDown = e => {
		const { x, y, inRect } = this.isInSelectionRect(e);
		if (inRect) {
			this.setState({
				dragging: e.nativeEvent.which == 1,
				targetOffsetX: this.state.selection.map(item => x - item.x),
				targetOffsetY: this.state.selection.map(item => y - item.y),
				initialSelectionPosition: this.state.selection.map(item => {
					return { x: item.x, y: item.y };
				})
			});
			return;
		}
		if (this.state.hoverTarget) {
			this.setState({
				dragging: e.nativeEvent.which == 1,
				targetOffsetX: [x - this.state.hoverTarget.x],
				targetOffsetY: [y - this.state.hoverTarget.y],
				initialSelectionPosition: [{ x: this.state.hoverTarget.x, y: this.state.hoverTarget.y }]
			});
		}
	};

	handleCanvasMouseClick = e => {
		if (this.mouseUpHandled) {
			this.mouseUpHandled = false;
			return false;
		}

		if (this.state.hoverTarget) {
			this.setState({selection: this.getSelectionItems(e)});			 
			e.stopPropagation();
			this.requestCanvasUpdate();
		}
	};

	handleCanvasDoubleClick = e => {
		if (this.state.hoverTarget && this.state.hoverTarget.type == "font") {
			this.refs.editTextBox.value = this.state.hoverTarget.text;
			this.refs.editTextModal.show();
		}
	};

	handleSelectionResizeStart = e => {
		var x = e.clientX - $(".canvas-holder").offset().left;
		var y = e.clientY - $(".canvas-holder").offset().top;

		$(e.target).addClass("active");
		this.setState({
			resizing: true,
			resizingHandle: e.target,
			initialX: x,
			initialY: y,
			initialSelectionLeft: this.state.selectionLeft,
			initialSelectionTop: this.state.selectionTop,
			intialSelectionWidth: this.state.selectionWidth,
			intialSelectionHeight: this.state.selectionHeight,
			startingZoom: this.state.selection.map(asset => asset.zoom),
			hoverTarget: null
		});
	};

	handleSelectionResize = e => {
		var zoomDelta, deltaX, deltaY, zoomDeltaX, zoomDeltaY;

		var x = e.clientX - $(".canvas-holder").offset().left;
		var y = e.clientY - $(".canvas-holder").offset().top;

		var initialWidth = this.state.intialSelectionWidth + 6;
		var initialHeight = this.state.intialSelectionHeight + 6;

		var handleClass = this.state.resizingHandle.className;

		if (this.state.resizing) {
			// determine handle position
			var isLeft =
				this.state.initialX <
				this.state.initialSelectionLeft + this.state.intialSelectionWidth / 2 - this.state.intialSelectionWidth * 0.1;
			var isRight =
				this.state.initialX >
				this.state.initialSelectionLeft + this.state.intialSelectionWidth / 2 + this.state.intialSelectionWidth * 0.1;
			var isTop =
				this.state.initialY <
				this.state.initialSelectionTop + this.state.intialSelectionHeight / 2 - this.state.intialSelectionHeight * 0.1;
			var isBottom =
				this.state.initialY >
				this.state.initialSelectionTop + this.state.intialSelectionHeight / 2 + this.state.intialSelectionHeight * 0.1;

			deltaX = (x - this.state.initialX) * (isLeft ? -1 : 1);
			deltaY = (y - this.state.initialY) * (isTop ? -1 : 1);

			if (isLeft || isRight) zoomDeltaX = (deltaX * 2) / initialWidth;
			if (isTop || isBottom) zoomDeltaY = (deltaY * 2) / initialHeight;

			if (zoomDeltaX) zoomDelta = zoomDeltaX;
			if (zoomDeltaY) zoomDelta = zoomDeltaY;
			if (zoomDeltaX && zoomDeltaY) zoomDelta = Math.abs(zoomDeltaX) > Math.abs(zoomDeltaY) ? zoomDeltaX : zoomDeltaY;

			if (zoomDelta) {
				for (var i = 0; i < this.state.selection.length; i++) {
					this.state.selection[i].zoom = _.round(
						Math.max(0.1, this.state.startingZoom[i] + zoomDelta * this.state.startingZoom[i]),
						3
					);
				}
			}

			this.requestCanvasUpdate();
		}
	};

	handleSelectionRotationStart = e => {
		this.setState({
			rotating: true,
			rotatingStartX: e.clientX,
			rotatingStartY: e.clientY,
			initialSelectionAngles: this.state.selection.map(asset => asset.angle - this.state.selectionAngle),
			initialAngle: this.state.selectionAngle,
			hoverTarget: null
		});
	};

	handleSelectionRotate(e) {
		var x = e.clientX - $(".canvas-holder").offset().left;
		var y = e.clientY - $(".canvas-holder").offset().top;
		var centerX = this.state.selectionLeft + this.state.selectionWidth / 2;
		var centerY = this.state.selectionTop + this.state.selectionHeight / 2;
		var angle = (Math.atan2(y - centerY, x - centerX) * 180.0) / Math.PI;

		for (var i = 0; i < this.state.selection.length; i++) {
			var asset = this.state.selection[i];
			asset.angle = _.round(
				this.state.initialSelectionAngles[i] ? this.state.initialSelectionAngles[i] + angle : angle,
				2
			);

			// if more than one asset in selection, adjust x and y based on the distance from centerX and centerY and the angle
		}

		this.setState({ selectionAngle: angle });
		this.requestCanvasUpdate();
	}

	handleSelectionFlip = e => {
		e.stopPropagation();
		const updated = this.state.selection.map(s=>{
			if(s.type==="image"){
				s.flipped = !s.flipped;
			}
			return s;
		});
		this.setState({selection:updated});
		//_.each(this.state.selection, asset => (asset.flipped = !asset.flipped));
		this.state.scene.updateStatus();
		this.requestCanvasUpdate();
	};

	handleSelectionDelete = e => {
		e.stopPropagation();
		confirm(
			"Your are about to remove the selected assets from this scene. You can add them back later by browsing the asset library. \nAre you sure you want to continue?"
		).then(() => {
			this.state.scene.removeAssets(this.state.selection);

			this.setState({
				selection: [],
				selectionLeft: null,
				selectionTop: null,
				selectionWidth: null,
				selectionHeight: null
			});
			this.state.scene.updateStatus();
			this.requestCanvasUpdate();
		});
	};

	splitItems = () =>{
		const selectedItems = new Array();
		const notSelectedItems = new Array();
		const notSelectedItemsIndexes = new Array();
		for (let i = 0; i < this.state.scene.items.length; i++) {
			notSelectedItemsIndexes.push(i);
		}

		this.state.selection.forEach(asset => {
			const index = this.state.scene.items.indexOf(asset);
			selectedItems.push({ index: index, item: asset });
			notSelectedItemsIndexes.splice(notSelectedItemsIndexes.indexOf(index), 1);
		});

		notSelectedItemsIndexes.forEach(num => {
			notSelectedItems.push({ index: num, item: this.state.scene.items[num] });
		});
		selectedItems.sort((a, b) => a.index - b.index);
		selectedItems.reverse();
		
		return {selected: selectedItems,notSelected: notSelectedItems};
	};

	mergeItems = (chunk1,chunk2)=>{
		const items = [];
		[...chunk1, ...chunk2].forEach(im => {
			items[im.index] = im.item;
		});
		return items;
	};

	handleBringForward = e => {
		e.stopPropagation();

		const {selected,notSelected} = this.splitItems();

		for (let i = 0; i < selected.length; i++) {
			if (selected[i].index + 1 >= this.state.scene.items.length) {
				break;
			}
			selected[i].index++;
			const fi = notSelected.find(no => no.index === selected[i].index);
			if (fi) {
				while (selected.find(so => so.index === fi.index)) {
					fi.index--;
				}
			}
		}

		this.state.scene.items = this.mergeItems(selected,notSelected);
		this.forceUpdate();

		this.state.scene.updateStatus();
		// this.requestCanvasUpdate();
	};

	handleSendBackwards = e => {
		e.stopPropagation();

		const {selected,notSelected} = this.splitItems();

		for (let i = selected.length - 1; i >= 0; i--) {
			if (selected[i].index <= 0) {
				break;
			}
			selected[i].index--;
			const fi = notSelected.find(no => no.index === selected[i].index);
			if (fi) {
				while (selected.find(so => so.index === fi.index)) {
					fi.index++;
				}
			}
		}

		this.state.scene.items = this.mergeItems(selected,notSelected);;
		this.forceUpdate();

		this.state.scene.updateStatus();
		// this.requestCanvasUpdate();
	};

	getObjectAt = (x, y) => {
		for (var i = this.state.scene.items.length - 1; i >= 0; i--) {
			var item = this.state.scene.items[i];
			var rx = item.x * this.state.initialCanvasWidth * this.state.zoom,
				ry = item.y * this.state.initialCanvasHeight * this.state.zoom,
				angle = item.angle || 0,
				px = x * this.state.initialCanvasWidth * this.state.zoom,
				py = y * this.state.initialCanvasHeight * this.state.zoom,
				size = item.measure(this.refs.mainCanvas, this.state.zoom);

			var p = this.pointInsideRectangle(rx, ry, size.width, size.height, angle, px, py);
			if (p && this.assetHasContentAt(item, p.x, p.y)) return item;
		}
		return null;
	};

	updateSelection = () => {
		if (this.state.selection.length > 0) {
			var minLeft = _.min(
				this.state.selection.map(
					asset =>
						asset.x * this.state.initialCanvasWidth * this.state.zoom -
						asset.measure(this.refs.mainCanvas, this.state.zoom).width / 2
				)
			);
			var minTop = _.min(
				this.state.selection.map(
					asset =>
						asset.y * this.state.initialCanvasHeight * this.state.zoom -
						asset.measure(this.refs.mainCanvas, this.state.zoom).height / 2
				)
			);
			var maxRight = _.max(
				this.state.selection.map(
					asset =>
						asset.x * this.state.initialCanvasWidth * this.state.zoom +
						asset.measure(this.refs.mainCanvas, this.state.zoom).width / 2
				)
			);
			var maxBottom = _.max(
				this.state.selection.map(
					asset =>
						asset.y * this.state.initialCanvasHeight * this.state.zoom +
						asset.measure(this.refs.mainCanvas, this.state.zoom).height / 2
				)
			);

			let left =
				$(".main-canvas").offset().left -
				$(".canvas-holder").offset().left +
				$(".canvas-holder").scrollLeft() +
				minLeft;
			let top =
				$(".main-canvas").offset().top - $(".canvas-holder").offset().top + $(".canvas-holder").scrollTop() + minTop;
			let width = maxRight - minLeft;
			let height = maxBottom - minTop;
			let angle = this.state.selection.length > 1 ? 0 : this.state.selection[0].angle || 0;

			if (
				this.state.selectionLeft != left ||
				this.state.selectionTop != top ||
				this.state.selectionWidth != maxRight - minLeft ||
				this.state.selectionHeight != maxBottom - minTop ||
				this.state.selectionAngle != angle
			)
				this.setState({
					selectionLeft: left,
					selectionTop: top,
					selectionWidth: maxRight - minLeft,
					selectionHeight: maxBottom - minTop,
					selectionAngle: angle
				});
		}
	};

	setCanvasCursor = (inRect) => {
		var cursor = "arrow";
		if (!inRect) {
			if (this.state.hoverTarget) {
				cursor = "pointer";
			}
			if (this.state.hoverTarget && this.state.selection.indexOf(this.state.hoverTarget) != -1) {
				cursor = "move";
			}
		}else if(this.state.selection.length){
				cursor = "move";
		}

		if (cursor != this.state.canvasCursor) this.setState({ canvasCursor: cursor });
	};

	centerCanvas = () => {
		let canvasWidth = this.state.initialCanvasWidth * this.state.zoom;
		let canvasHeight = this.state.initialCanvasHeight * this.state.zoom;
		var align = "";

		if (canvasWidth < $(".canvas-holder").width() && canvasHeight < $(".canvas-holder").height())
			align = "absolute-center";
		else if (canvasWidth > $(".canvas-holder").width() && canvasHeight < $(".canvas-holder").height())
			align = "absolute-vcenter";
		else if (canvasWidth < $(".canvas-holder").width() && canvasHeight > $(".canvas-holder").height())
			align = "absolute-hcenter";

		if (align != this.state.canvasAlign) this.setState({ canvasAlign: align });
	};

	toggleShowGrid = () => {
		this.setState({ showGrid: !this.state.showGrid });
	};

	handleCanvasContextMenu = e => {
		let x = e.clientX;
		let y = e.clientY;
		if (this.state.selection.length == 1) {
			this.refs.assetContextMenu.show(this.state.selection[0], x, y);
		}
		this.updateSelection();
	};

	/* ----- ITEMS ----- */
	handleSelectItem = item => {
		this.setState({ selection: [item] });
		this.requestCanvasUpdate();
	};

	clearSelection = () => {
		this.setState({
			selection: [],
			selectionLeft: null,
			selectionTop: null,
			selectionWidth: null,
			selectionHeight: null
		});
	};

	handleFisnishedEditingText = e => {
		if (this.refs.editTextBox.value == "") {
			alert("Text cannot be empty.");
			return;
		}
		var asset = this.state.hoverTarget || this.state.selection[0];
		if (!asset) return;

		var cps = 12.5;
		if (asset.text.length > 0) cps = (asset.text.length * 1000) / asset.animationDuration;

		asset.text = this.refs.editTextBox.value;
		asset.animationDuration = Math.round((asset.text.length / cps) * 1000);

		this.refs.editTextModal.hide();

		asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style);
		this.state.scene.updateStatus();
	};

	alignTextLeft = e => {
		var asset = this.state.hoverTarget || this.state.selection[0];
		if (!asset) return;

		asset.align = "left";
		asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style);
		this.state.scene.updateStatus();
		this.requestCanvasUpdate();
		e.stopPropagation();
	};

	alignTextCenter = e => {
		var asset = this.state.hoverTarget || this.state.selection[0];
		if (!asset) return;

		asset.align = "center";
		asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style);
		this.state.scene.updateStatus();
		this.requestCanvasUpdate();
		e.stopPropagation();
	};

	alignTextRight = e => {
		var asset = this.state.hoverTarget || this.state.selection[0];
		if (!asset) return;

		asset.align = "right";
		asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style);
		this.state.scene.updateStatus();
		this.requestCanvasUpdate();
		e.stopPropagation();
	};

	updateSceneStatus = event => {
		this.state.scene.updateStatus();
		if (event && (event.action == "change_animation_duration" || event.action == "change_animation_delay"))
			this.state.scene.history.push(event);
	};

	handleEditAsset = () => {
		if (this.props.videoActionListener) {
			this.props.videoActionListener({
				action: "edit_asset",
				data: {
					asset: this.state.selection[0]
				}
			});
		}
	};

	showAssetSettings = e => {
		e.stopPropagation();
		this.refs.assetSettings.show();
	};

	handleApplyAssetSettings = () => {
		this.state.selection.forEach(asset=>{
			asset.createImageCache(this.state.zoom, this.state.fullPreviewZoom, this.props.video && this.props.video.style);
		});
		this.updateSceneStatus();
	};

	handleMoveSelection = (leftOffset, topOffset) => {
		this.state.selection.forEach(asset => {
			asset.x += (leftOffset / this.state.initialCanvasWidth) * this.state.zoom;
			asset.y += (topOffset / this.state.initialCanvasHeight) * this.state.zoom;
		});

		this.requestCanvasUpdate();
	};

	/* ----- PREVIEW ------- */
	startPreview = () => {
		Hand.useSet(0);
		this.refs.previewModal.show();
		this.setState({ animationStartTime: Date.now() });
		this.currentAnimation = requestAnimationFrame(this.drawPreview);
	};

	drawPreview = () => {
		if (!this.refs.previewCanvasFull) return;

		var animationDuration = _.sum(
				this.state.scene.items.map(item => (item.animationDelay || 0) + item.animationDuration)
			),
			elapsed = Date.now() - this.state.animationStartTime;

		var frame = document.createElement("canvas");
		frame.width = this.refs.previewCanvasFull.width;
		frame.height = this.refs.previewCanvasFull.height;

		this.state.scene.drawPartial(
			frame,
			this.state.fullPreviewZoom,
			elapsed,
			true,
			this.props.video && this.props.video.style,
			true
		);

		var ctx = this.refs.previewCanvasFull.getContext("2d");
		ctx.globalCompositeOperation = "source-over";

		if (this.props.video && this.props.video.style == "blackboard") {
			ctx.drawImage(chalkboard, 0, 0, this.refs.previewCanvasFull.width, this.refs.previewCanvasFull.height);
		} else if (this.props.video && this.props.video.style == "greenboard") {
			ctx.drawImage(chalkboard_green, 0, 0, this.refs.previewCanvasFull.width, this.refs.previewCanvasFull.height);
		} else {
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, this.refs.previewCanvasFull.width, this.refs.previewCanvasFull.height);
		}

		ctx.drawImage(frame, 0, 0);

		if (elapsed < animationDuration) {
			this.elapsed = elapsed;
			this.startingAnimation = setTimeout(() => {
				this.currentAnimation = requestAnimationFrame(this.drawPreview);
			}, 1000 / 30);
		} else {
			delete this.elapsed;
			delete this.currentAnimation;
		}
	};

	pausePreview = () => {
		if (this.startingAnimation) clearTimeout(this.startingAnimation);

		if (this.currentAnimation) {
			cancelAnimationFrame(this.currentAnimation);
			delete this.currentAnimation;
		} else {
			this.setState({ animationStartTime: Date.now() - (this.elapsed || 0) });
			this.currentAnimation = requestAnimationFrame(this.drawPreview);
		}
	};

	handleDismissPreview = () => {
		if (this.currentAnimation) {
			cancelAnimationFrame(this.currentAnimation);
		}
		if (this.startingAnimation) {
			clearTimeout(this.startingAnimation);
			this.startingAnimation = null;
		}
	};

	/* ----- TOOLS ----- */
	handleZoomIn = () => {
		var computedZoom = Math.min(this.state.zoom + this.state.initialZoom * 0.2, this.state.initialZoom * 5);
		this.setState({
			zoom: computedZoom
		});
		if (computedZoom != this.state.zoom) {
			this.requestCanvasUpdate();
			setTimeout(() => {
				delete this.cachedAsset;
				this.state.scene.updateImageCache(this.state.zoom, 0, this.props.video && this.props.video.style);
				this.requestCanvasUpdate();
			}, 50);
		}
	};

	handleZoomOut = () => {
		var computedZoom = Math.max(this.state.zoom - this.state.initialZoom * 0.2, this.state.initialZoom / 2);
		this.setState({
			zoom: computedZoom
		});
		if (computedZoom != this.state.zoom) {
			this.requestCanvasUpdate();
			setTimeout(() => {
				delete this.cachedAsset;
				this.state.scene.updateImageCache(this.state.zoom, 0, this.props.video && this.props.video.style);
				this.requestCanvasUpdate();
			}, 50);
		}
	};

	/* ----- ASSETS ----- */
	assetsIntersect = (asset1, asset2) => {
		var m1 = asset1.measure(this.refs.mainCanvas, this.state.zoom);
		var m2 = asset2.measure(this.refs.mainCanvas, this.state.zoom);

		return !(
			m2.left > m1.left + m1.width ||
			m2.left + m2.width < m1.left ||
			m2.top > m1.top + m1.height ||
			m2.top + m2.height < m1.top
		);
	};

	assetHasContentAt = (asset, x, y) => {
		if (asset.type != "image") return true;

		if (this.cachedAsset != asset) {
			if (!asset.cachedImg) asset.createImageCache(this.state.zoom, 0, this.props.video && this.props.video.style);

			this.canvas = document.createElement("canvas");
			this.canvas.width = asset.cachedImg.width;
			this.canvas.height = asset.cachedImg.height;
		}

		var ctx = this.canvas.getContext("2d");

		if (this.cachedAsset != asset) {
			ctx.drawImage(asset.cachedImg, 0, 0);
			this.cachedAsset = asset;
		}

		if (asset.flipped) x = asset.cachedImg.width - x;

		return ctx.getImageData(x, y, 1, 1).data[3] > 0;
	};

	/* ----- MATH ----- */
	pointInsideRectangle = (rx, ry, rw, rh, angle, x, y) => {
		var angleRad = ((angle || 0) * Math.PI) / 180;
		var dx = x - rx;
		var dy = y - ry;

		// distance between point and centre of rectangle.
		var h1 = Math.sqrt(dx * dx + dy * dy);

		var currA = Math.atan2(dy, dx);

		// angle of point rotated by the rectangle amount around the centre of rectangle.
		var newA = currA - angleRad;

		// x2 and y2 are the new positions of the point when rotated to offset the rectangles orientation.
		var x2 = Math.cos(newA) * h1 + 0.5 * rw;
		var y2 = Math.sin(newA) * h1 + 0.5 * rh;

		if (x2 >= 0 && x2 <= rw && y2 >= 0 && y2 <= rh) return { x: x2, y: y2 };
		return null;
	};

	rotatedRectanglePoint = (rx, ry, rw, rh, angle, x, y) => {
		var angleRad = ((angle || 0) * Math.PI) / 180;
		var dx = x - rx;
		var dy = y - ry;

		// distance between point and centre of rectangle.
		var h1 = Math.sqrt(dx * dx + dy * dy);

		var currA = Math.atan2(dy, dx);

		// angle of point rotated by the rectangle amount around the centre of rectangle.
		var newA = currA + angleRad;

		// x2 and y2 are the new positions of the point when rotated to offset the rectangles orientation.
		var x2 = Math.cos(newA) * h1 + 0.5 * rw;
		var y2 = Math.sin(newA) * h1 + 0.5 * rh;

		return { x: x2, y: y2 };
	};

	/* ----- FONTS ----- */
	cachedFont = path => {
		var index = _.findIndex(this.state.cachedFonts, item => item.path == path);
		if (index >= 0) return this.state.cachedFonts[index].type;
		return null;
	};
}

export default SceneEditor;
