import React from 'react'
import PropTypes from 'prop-types'
import $ from 'jquery'

import Hand from 'hands'

import Modal from 'components/common/modal'

class VideoSettings extends React.Component {
  static propTypes = {
    video: PropTypes.object.isRequired,
    videoActionListener: PropTypes.func.isRequired
  }

  state = {
    style: 'whiteboard',
    whiteboardHandSet: 0,
    blackboardHandSet: 0,
    greenboardHandSet: 0,
    glassboardHandSet: 0,
  }

  componentDidMount() {
    this.update();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props != prevProps)
      this.update();
  }

  render() {
    let hands = Hand.sets.whiteboard;
    let currentHandSet = this.state.whiteboardHandSet;

    if (this.state.style == 'blackboard') {
      hands = Hand.sets.blackboard;
      currentHandSet = this.state.blackboardHandSet;
    } else
    if (this.state.style == 'greenboard') {
      hands = Hand.sets.blackboard;
      currentHandSet = this.state.greenboardHandSet;
    } else
    if (this.state.style == 'glassboard') {
      hands = Hand.sets.glassboard;
      currentHandSet = this.state.glassboardHandSet;
    }

    let hasEraser = currentHandSet != -1 && currentHandSet < hands.length && hands[currentHandSet].erasers.length > 0;

    return (
      <Modal ref="modal" className="video-settings" title="Video Settings">
        <div className="group">
          <label>Style:</label>
          <div className="flex center space-between">
            <div className={'style-wrapper' + (this.state.style == 'whiteboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, 'whiteboard')}>
              <div className="style" style={{background: 'white', border: '1px solid #ccc'}}>
                {
                  this.state.whiteboardHandSet != -1 &&
                  <img src={Hand.sets.whiteboard[this.state.whiteboardHandSet].angles[0].src}/>
                }

              </div>
              <i className={'fa fa-angle-' + (this.state.style == 'whiteboard' ? 'down' : 'up')}/>
              Whiteboard
            </div>
            <div className={'style-wrapper' + (this.state.style == 'blackboard' || this.state.style == 'greenboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, this.state.currentChalkboardStyle)}>
              <div className="style" style={{background: this.state.currentChalkboardStyle == 'greenboard' ? '#2f5848' : '#333'}}>
                <div className="options flex column">
                  <div
                    className={'option' + (this.state.currentChalkboardStyle == 'blackboard' ? ' selected' : '')}
                    style={{background: '#333'}}
                    onClick={this.setStyle.bind(this, 'blackboard')}/>
                  <div
                    className={'option' + (this.state.currentChalkboardStyle == 'greenboard' ? ' selected' : '')}
                    style={{background: '#2f5848'}}
                    onClick={this.setStyle.bind(this, 'greenboard')}/>
                </div>
                {
                  this.state.currentChalkboardStyle == 'blackboard' && this.state.blackboardHandSet != -1 &&
                  <img src={Hand.sets.blackboard[this.state.blackboardHandSet].angles[0].src}/>
                }
                {
                  this.state.currentChalkboardStyle == 'greenboard' && this.state.glassboardHandSet != -1 &&
                  <img src={Hand.sets.blackboard[this.state.glassboardHandSet].angles[0].src}/>
                }
              </div>
              <i className={'fa fa-angle-' + (this.state.style == 'blackboard' ? 'down' : 'up')}/>
              Chalkboard
            </div>
            <div className={'style-wrapper glassboard' +  (this.state.style == 'glassboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, 'glassboard')}>
              <div className="style" style={{background: 'white', border: '1px solid #ccc'}}>
                {
                  this.state.glassboardHandSet != -1 && this.state.glassboardHandSet < Hand.sets.glassboard.length &&
                  <img src={Hand.sets.glassboard[this.state.glassboardHandSet].angles[0].src}/>
                }
              </div>
              <i className={'fa fa-angle-' + (this.state.style == 'glassboardHandSet' ? 'down' : 'up')}/>
              Glassboard
            </div>
          </div>
          <div className={'hands flex center ' + this.state.style }>
            {
              hands.map((set, index) => {
                let is_selected = (currentHandSet == index);
                return (
                  <div
                    className={'hand-wrapper no-shrink' + (is_selected ? ' selected' : '')}
                    key={index}
                    onClick={this.selectHand.bind(this, index)}>
                    <div style={{
                      backgroundImage: 'url(\''+set.angles[0].src+'\')',
                      backgroundPosition: 'center',
                      backgroundSize: 'auto 100%',
                      backgroundRepeat: 'no-repeat',
                      height: '100%',
                    }}/>
                  </div>
                )
              })
            }
            <div
              className={'hand-wrapper no-shrink' + ( currentHandSet == -1 ? ' selected' : '' )}
              key={hands.length}
              onClick={this.selectHand.bind(this, -1)}>
              <div className="flex center space-around no-hand">NO<br/>HAND</div>
            </div>
            <div key={hands.length + 1} style={{width: 20}} className="no-shrink">&nbsp;</div>
          </div>
        </div>
        <div className="group">
          <label>Title:</label>
          <input type="text" ref="title" placeholder="No title" />
        </div>
        <div className="group">
          <label>Settings:</label>
          <div className="settings flex space-between">
            <div className="flex column" style={{marginRight: '3%'}}>
              <span>Video ends when:</span>
              <div className="pretty-select">
                <select ref="videoEnd" onChange={this.changeVideoEnd}>
                  <option value="both">both the animation and audio end</option>
                  <option value="animation">animation ends</option>
                </select>
              </div>
            </div>
            <div className="flex column" style={{marginRight: '3%'}}>
              <span>Scene transition:</span>
              <div className="pretty-select">
                <select ref="sceneTransition" onChange={this.changeSceneTransition}>
                  <option value="swipe-left">Swipe left</option>
                  <option value="swipe-right">Swipe right</option>
                  <option value="swipe-up">Swipe up</option>
                  <option value="swipe-down">Swipe down</option>
                  <option value="swipe-mixed">Swipe mixed</option>
                  <option value="camera-panning">Camera panning</option>
                </select>
              </div>
            </div>
            <div className={'flex column' + (!hasEraser ? ' disabled' : '')} style={{flexShrink: 0}}>
              <span>Erase mode:</span>
              <div className="pretty-select">
                <select ref="eraseMode" disabled={!hasEraser} onChange={this.changeEraseMode}>
                  <option value="smart">Smart Mode</option>
                  <option value="finger">With Finger</option>
                  <option value="eraser">With Eraser</option>
                  <option value="off">Off</option>
                </select>
              </div>
              {
                !hasEraser &&
                <span className="note">&nbsp;(Unavailable)</span>
              }
            </div>
          </div>
        </div>
        <div className="group">
          <div className="text-right">
            <a href="javascript:;" onClick={this.cancel}>Cancel</a>&nbsp;&nbsp;&nbsp;
            <button className="btn lg success" onClick={this.save}>Apply</button>
          </div>
        </div>
      </Modal>
    );
  }

  update = () => {
    if (this.props.video) {
      this.refs.title.value = this.props.video.title;
      this.refs.videoEnd.value = this.props.video.videoEnd;
      this.refs.eraseMode.value = this.props.video.eraseMode;
      this.refs.sceneTransition.value = this.props.video.sceneTransition;

      let whiteboardHandSet = this.props.video.style == 'whiteboard' ? (this.props.video.handSet != undefined ? this.props.video.handSet : Hand.sets.default_whiteboard_set) : Hand.sets.default_whiteboard_set;
      let blackboardHandSet = this.props.video.style == 'blackboard' ? (this.props.video.handSet != undefined ? this.props.video.handSet : Hand.sets.default_blackboard_set) : Hand.sets.default_blackboard_set;
      let greenboardHandSet = this.props.video.style == 'greenboard' ? (this.props.video.handSet != undefined ? this.props.video.handSet : Hand.sets.default_greenboard_set) : Hand.sets.default_greenboard_set;
      let glassboardHandSet = this.props.video.style == 'glassboard' ? (this.props.video.handSet != undefined ? this.props.video.handSet : Hand.sets.default_glassboard_set) : Hand.sets.default_glassboard_set;

      this.setState({
        style: this.props.video.style,
        currentChalkboardStyle: 'blackboard',
        videoEnd: this.props.video.videoEnd,
        eraseMode: this.props.video.eraseMode,
        sceneTransition: this.props.video.sceneTransition,
        whiteboardHandSet: whiteboardHandSet,
        blackboardHandSet: blackboardHandSet,
        greenboardHandSet: greenboardHandSet,
        glassboardHandSet: glassboardHandSet,
       });
    }
  }



  show = () => {
    this.update();
    this.refs.modal.show();
  }

  cancel = () => {
    this.refs.modal.hide();
  }

  changeVideoEnd = () => {
    this.setState({videoEnd: this.refs.videoEnd.value})
  }

  changeSceneTransition = () => {
    this.setState({sceneTransition: this.refs.sceneTransition.value})
  }

  changeEraseMode = () => {
    this.setState({eraseMode: this.refs.eraseMode.value})
  }

  setStyle = (style, event) => {
    event.stopPropagation();
    this.setState({
      style: style,
      currentChalkboardStyle: (style == 'blackboard' || style == 'greenboard') ? style : this.state.currentChalkboardStyle,
    });
  }

  showHandsModal = () => {
    this.refs.hands_modal.show();
  }

  selectHand = (index) => {
    switch (this.state.style) {
      case 'blackboard':
        this.setState({blackboardHandSet: index});
        break;
      case 'greenboard':
        this.setState({greenboardHandSet: index});
        break;
      case 'glassboard':
        this.setState({glassboardHandSet: index});
        break;
      default:
        this.setState({whiteboardHandSet: index});
    }
  }

  save = () => {
    let hands = Hand.sets.whiteboard;
    let currentHandSet = this.state.whiteboardHandSet;

    if (this.state.style == 'blackboard') {
      hands = Hand.sets.blackboard;
      currentHandSet = this.state.blackboardHandSet;
    } else
    if (this.state.style == 'greenboard') {
      hands = Hand.sets.blackboard;
      currentHandSet = this.state.greenboardHandSet;
    } else
    if (this.state.style == 'glassboard') {
      hands = Hand.sets.glassboard;
      currentHandSet = this.state.glassboardHandSet;
    }

    let hasEraser = currentHandSet != -1 && currentHandSet < hands.length && hands[currentHandSet].erasers.length > 0;

    this.refs.modal.hide();
    $('.toast').html('Applying settings...').fadeIn(500);

    this.props.video.title = this.refs.title.value;
    this.props.video.style = this.state.style;
    this.props.video.handSet = currentHandSet;
    this.props.video.videoEnd = this.state.videoEnd;

    this.props.video.sceneTransition = this.state.sceneTransition;
    this.props.video.scenes.filter(scene => scene.exitAnimation != 'none').forEach(scene => {
      if (this.state.sceneTransition == 'swipe-mixed') {
        let transitions = ['swipe-left', 'swipe-right', 'swipe-up', 'swipe-down'];
        scene.exitAnimation = transitions[Math.floor(Math.random() * transitions.length)];
      } else {
        scene.exitAnimation = this.state.sceneTransition;
      }
    })

    if (hasEraser)
      this.props.video.eraseMode = this.state.eraseMode;

    setTimeout(() => {
      if (this.props.videoActionListener) {
        // update image cache
        this.props.videoActionListener({ action: 'update_image_cache' });

        // force thumbnail update
        this.props.video.scenes.forEach(scene => {
          delete scene.loadedThumbnailData;
          delete scene.prev_thumbnail_data;
          scene.updateStatus();
        })

        // trigger video update
        this.props.videoActionListener({ action: 'change' });
      }

      Hand.useSet(this.props.video.handSet, this.props.video.style, () => {
        $('.toast').html('Settings applied successfully');
        setTimeout(() => { $('.toast').fadeOut(500) }, 2000);
      });
    }, 500);
  }

}

export default VideoSettings
