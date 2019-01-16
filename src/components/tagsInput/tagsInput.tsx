import React from "react";
import { WithContext as ReactTags } from "react-tag-input";
import { randomIntInRange } from "../../common/utils";
import { ITag } from "../../models/models";
import "../common.scss";
import { KeyCodes } from "../../common/utils";
import "./tagsInput.scss";
// tslint:disable-next-line:no-var-requires
const defaultTagColors = require("./tagColors.json");

const defaultValues = {
    tagColors: defaultTagColors,
    delimiters: [KeyCodes.comma, KeyCodes.enter],
    placeHolder: "Add new tag",
};

/**
 * Interface for model required to work with lower level
 * tags input component. Rather than name, uses 'id'.
 * Requires text attribute, which is used to inject
 * HTML to customize the tags
 * @member id - Unique identifier for tag (name)
 * @member text - Text to display on tag (can be HTML object)
 * @member color - Hex color of box to display left of tag name
 */
export interface IReactTag {
    id: string;
    text: any;
    color: string;
}

/**
 * Properties required for TagsInput component
 * @member tags - ITag[] or stringified ITag[]
 * @member onChange - function to call on tags change
 * @member placeHolder - Place holder for input text box.
 * Default is "Add new tag"
 * @member delimiters - Key code delimiters for creating a new tag
 * Defaults are enter (13) and comma (188)
 */
export interface ITagsInputProps {
    tags: ITag[];
    onChange: (tags: ITag[]) => void;

    // Props with default values
    placeHolder?: string;
    delimiters?: number[];
}

/**
 * Current state of tags input component
 * @member tags - IReactTag[] - tags used in lower level component
 * @member currentTagColorIndex - rotates initial color to apply to tags
 * @member selectedTag - tag that was most recently double clicked,
 *     used to populate modal
 * @member showModal - boolean to show tag editor modal or not
 */
export interface ITagsInputState {
    tags: IReactTag[];
    currentTagColorIndex: number;
    selectedTag: IReactTag;
    showModal: boolean;
}

/**
 * Component for creating, modifying and using tags
 */
export default class TagsInput<T extends ITagsInputProps> extends React.Component<T, ITagsInputState> {

    private tagColors: {[id: string]: string};
    private tagColorKeys: string[];

    constructor(props) {
        super(props);

        this.tagColors = props.tagColors || defaultValues.tagColors;
        this.tagColorKeys = Object.keys(this.tagColors);

        this.state = {
            tags: this.toReactTags(this.props.tags),
            currentTagColorIndex: randomIntInRange(0, this.tagColorKeys.length),
            selectedTag: null,
            showModal: false,
        };

        // UI Handlers
        this.handleTagClick = this.handleTagClick.bind(this);
        this.handleDrag = this.handleDrag.bind(this);
        this.handleCloseModal = this.handleCloseModal.bind(this);
        // Tag edit handlers
        this.handleAddition = this.handleAddition.bind(this);
        this.handleEditedTag = this.handleEditedTag.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        // Helpers
        this.toReactTag = this.toReactTag.bind(this);
        this.getTag = this.getTag.bind(this);
    }

    public render() {
        const { tags } = this.state;
        return (
            <div>
                <ReactTags tags={tags}
                    placeholder={this.props.placeHolder || defaultValues.placeHolder}
                    autofocus={false}
                    handleDelete={this.handleDelete}
                    handleAddition={this.handleAddition}
                    handleDrag={this.handleDrag}
                    delimiters={this.props.delimiters || defaultValues.delimiters} />
            </div>
        );
    }

    public componentDidUpdate(prevProps: ITagsInputProps) {
        if (prevProps.tags !== this.props.tags) {
            this.setState({
                tags: this.toReactTags(this.props.tags),
            });
        }
    }

    // UI Handlers

    /**
     * Calls the onTagClick handler if not null with clicked tag
     * @param event Click event
     */
    protected handleTagClick(event) {
        const text = this.getTagIdFromClick(event);
        const tag = this.getTag(text);
        if (event.ctrlKey) {
            this.openEditModal(tag);
        }
    }

    /**
     * Opens editor modal with specified tag as values
     * @param tag - Set as selected tag to display in editor modal
     */
    protected openEditModal(tag: IReactTag) {
        this.setState({
            selectedTag: tag,
            showModal: true,
        });
    }

    // Helpers

    /**
     * Gets the tag with the given name (id)
     * @param id string name of tag. param 'id' for lower level react component
     */
    protected getTag(id: string): IReactTag {
        const match = this.state.tags.find((tag) => tag.id === id);
        if (!match) {
            throw new Error(`No tag by id: ${id}`);
        }
        return match;
    }

    /**
     * Gets tag ID (name) from a click event
     * @param event Click event
     */
    protected getTagIdFromClick(event): string {
        if (event.target.lastChild) {
            return event.target.lastChild.data;
        }
        return (event.target.innerText || event.currentTarget.innerText).trim();
    }

    /**
     * Generate necessary HTML to render tag box appropriately
     * @param name name of tag
     * @param color color of tag
     */
    protected ReactTagHtml(name: string, color: string) {
        return (
            <div className="tag inline-block" onClick={(event) => this.handleTagClick(event)}>
                <div className="tag-contents">
                    <div className="tag-color-box" style={{ backgroundColor: color }}></div>
                    {this.getTagSpan(name)}
                </div>
            </div>
        );
    }

    /**
     * Get span element for each tag
     */
    protected getTagSpan(name: string) {
        return <span>{name}</span>;
    }

    /**
     * Converts IReactTag to ITag
     * @param tag IReactTag to convert to ITag
     */
    protected toItag(tag: IReactTag): ITag {
        if (!tag) {
            return null;
        }
        return {
            name: tag.id,
            color: tag.color,
        };
    }

    /**
     * Allows for click-and-drag re-ordering of tags
     * @param tag Tag being dragged
     * @param currPos Current position of tag
     * @param newPos New position of tag
     */
    private handleDrag(tag: IReactTag, currPos: number, newPos: number): void {
        const tags = [...this.state.tags];
        const newTags = tags.slice();

        newTags.splice(currPos, 1);
        newTags.splice(newPos, 0, tag);

        this.updateTagsHtml(newTags);

        // Updating HTML is dependent upon state having most up to date
        // values. Setting filtered state and then setting state with
        // updated HTML in tags
        this.setState({
            tags: newTags,
        }, () => this.setState({
            tags: this.updateTagsHtml(newTags),
        }, () => this.props.onChange(this.toITags(this.state.tags))));
    }

    /**
     * Set showModal to false
     */
    private handleCloseModal(): void {
        this.setState({
            showModal: false,
        });
    }

    // Tag Operations

    /**
     * Adds new tag to state with necessary HTML for rendering
     * Sets the color of the tag to next color, rotates through each
     * @param reactTag - IReactTag - new tag to add to state
     */
    private handleAddition(reactTag: IReactTag): void {
        reactTag.color = this.tagColors[this.tagColorKeys[this.state.currentTagColorIndex]];
        this.addHtml(reactTag);
        this.setState((prevState) => {
            return {
                tags: [...this.state.tags, reactTag],
                currentTagColorIndex: (prevState.currentTagColorIndex + 1) % this.tagColorKeys.length,
            };
        }, () => this.props.onChange(this.toITags(this.state.tags)));
    }

    /**
     * Update an existing tag, called after clicking 'OK' in modal
     * @param newTag Edited version of tag
     */
    private handleEditedTag(newTag: ITag): void {
        const newReactTag = this.toReactTag(newTag);
        /**
         * If this was a name change (ids are not equal), don't allow
         * the new tag to be named with a name that currently exists
         * in other tags. Probably should include an error message.
         * For now, just doesn't allow the action to take place. Modal
         * won't close and user won't be able to set the name. This is
         * similar to how the component handles duplicate naming at the
         * creation level. If user enters name that already exists in
         * tags, the component just doesn't do anything.
         */
        if (newReactTag.id !== this.state.selectedTag.id && this.state.tags.some((t) => t.id === newReactTag.id)) {
            return;
        }
        this.addHtml(newReactTag);
        this.setState((prevState) => {
            return {
                tags: prevState.tags.map((reactTag) => {
                    if (reactTag.id === prevState.selectedTag.id) {
                        reactTag = newReactTag;
                    }
                    return reactTag;
                }),
                showModal: false,
            };
        }, () => this.props.onChange(this.toITags(this.state.tags)));
    }

    /**
     * Deletes tag from state
     * Explicitly prevents deletion with backspace key
     * @param i index of tag being deleted
     * @param event delete event
     */
    private handleDelete(i: number, event): void {
        if (event.keyCode === KeyCodes.backspace) {
            return;
        }
        const tags = this.state.tags.filter((tag, index) => index !== i);

        // Updating HTML is dependent upon state having most up to date
        // values. Setting filtered state and then setting state with
        // updated HTML in tags
        this.setState({
            tags,
        }, () => this.setState({
            tags: this.updateTagsHtml(tags),
        }, () => this.props.onChange(this.toITags(this.state.tags))));
    }

    /**
     * Converts ITag to IReactTag
     * @param tag ITag to convert to IReactTag
     */
    private toReactTag(tag: ITag): IReactTag {
        if (!tag) {
            return null;
        }
        return {
            id: tag.name,
            text: this.ReactTagHtml(tag.name, tag.color),
            color: tag.color,
        };
    }

    private updateTagsHtml(tags: IReactTag[]): IReactTag[] {
        const newTags = [];
        for (const tag of tags) {
            this.addHtml(tag);
            newTags.push(tag);
        }
        return newTags;
    }

    /**
     * Adds necessary HTML for tag to render correctly
     * @param tag tag needing Html
     */
    private addHtml(tag: IReactTag): void {
        tag.text = this.ReactTagHtml(tag.id, tag.color);
    }

    /**
     * Convert array of ITags to IReactTags
     * @param props properties for component, contains tags in ITag format
     */
    private toReactTags(tags: ITag[]): IReactTag[] {
        return tags ? tags.map((element: ITag) => this.toReactTag(element)) : [];
    }

    /**
     * Convert array of IReactTags to ITags
     * @param tags array of IReactTags to convert to ITags
     */
    private toITags(tags: IReactTag[]): ITag[] {
        return tags.map((element: IReactTag) => this.toItag(element));
    }
}
