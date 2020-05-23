import React, { Component } from 'react';
import PropTypes from 'prop-types';

class ScenesTimelineItem extends Component {
  static propTypes = {
    scene: PropTypes.object.isRequired,
    selected: PropTypes.bool.isRequired,
    dragged: PropTypes.bool.isRequired,
    exitTime: PropTypes.number.isRequired,
    videoStyle: PropTypes.string.isRequired,
    onStartResizing: PropTypes.func.isRequired,
  }

  render() {
    const { scene, selected, dragged, exitTime, videoStyle, onStartResizing, ...otherProps } = this.props;
    return (
      <div
        className={'scene flex center space-around no-shrink' +
          (selected ? ' selected' : '') +
          (dragged ? ' hidden' : '') +
          ' ' + videoStyle}
        style={{
          width: (scene.animationTime + exitTime) / 1000 * 50,
          backgroundColor: videoStyle == 'greenboard' ? '#2f5848' : 'white',
          backgroundImage: 'url(\'' + (scene.thumbnail || scene.thumb_path || '') + '\')',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'auto 100%',
          backgroundBlendMode: videoStyle == 'greenboard' ? 'screen' : 'multiply',
        }}
        {...otherProps}
        >
        <div className="resize-handle" onMouseDown={onStartResizing} draggable={false}/>
      </div>
    );
  }
}

export default ScenesTimelineItem;